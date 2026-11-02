import { germanLabel, formatNumber } from '../../lib/german';
import {StateIllustration,failureIllustration} from '@/components/BrandAssets';
import { useEffect, useState } from "react";
import { useLocalSearchParams } from "expo-router";
import { ActivityIndicator, Text, View } from "react-native";
import { CatalogAttribution, openCatalogLink } from "@/components/CatalogAttribution";
import { ProductImage } from "@/components/ProductImage";
import { ProductEstimateNotice } from '@/components/ProductEstimateNotice';
import { AddProductButton } from '@/components/AddProductButton';
import { EmptyState, ErrorMessage, InfoCard, PreferenceRow, Screen, SectionCard, TextButton } from "@/components/ui";
import { getProductRepository } from "@/services/products";
import { allergenConflicts, dietaryFields, dietaryNames, estimatedPrice, hasDiscoveryPreferences, matchesPreferences } from "@/services/catalog/discovery";
import { usePreferences } from "@/context/PreferencesContext";
import { categoryLabels, type Product } from "@/types/product";
import { colors, ui } from "@/lib/theme";
const displayList = (values: string[]) => values.map(germanLabel).join(", ").replace(/_/g, " ");
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
      if (!controller.signal.aborted) { setFailureKind(failureIllustration(cause)); setError("Das Produkt konnte nicht geladen werden. Prüfe deine Verbindung und versuche es erneut."); }
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [id, revision]);
  const risk = product ? allergenConflicts(product, saved) : null;
  return <Screen top={false} bottom>
    {loading ? <ActivityIndicator size="large" color={colors.primary} accessibilityLabel="Produktdetails werden geladen" /> : error ? <>
      <StateIllustration kind={failureKind} /><ErrorMessage message={error} /><TextButton label="Erneut versuchen" onPress={() => setRevision(v => v + 1)} />
    </> : !product ? <EmptyState illustration="dataError" title="Produkt nicht gefunden" description="Dieser Artikel ist möglicherweise nicht mehr im Katalog. Gehe zurück, um andere Produkte zu entdecken." /> : <>
      <ProductImage uri={product.displayImageUrl} width={product.imageWidth} height={product.imageHeight} name={product.name} large />
      <View style={ui.stack}>
        <Text style={ui.caption}>{product.brand ?? "Marke nicht angegeben"} · {categoryLabels[product.category]}</Text>
        <Text style={ui.heading}>{product.name}</Text>
        <Text style={ui.body}>{product.quantityLabel ?? (product.packageSize && product.packageUnit ? `${product.packageSize} ${product.packageUnit}` : "Packungsgröße nicht angegeben")}</Text>
        <Text style={[ui.subheading, { color: colors.primary }]}>{estimatedPrice(product)}</Text>
        {product.priceEstimate !== null && <Text style={ui.caption}>{product.priceEstimateVersion==='synthetic-category-demo-2'?"Unsicherer Demo-Preis der Kategorie. Die Packungsmenge ist unbestätigt.":product.priceEstimateSource==='synthetic_mvp'?"Für die Entwicklung geschätzter Wert anhand von Produkttyp und Packungsgröße.":"Geschätzter Packungspreis."}  Kein aktuelles Supermarktangebot.</Text>}
      </View>
      {product.source === "demo" && <InfoCard title="Fiktives Demo-Produkt">Dieses Beispielprodukt verwendet beispielhafte Nährwerte und Preise statt importierter Produktdaten.</InfoCard>}
      <AddProductButton product={product} />
      {risk && (!!risk.contains.length || !!risk.traces.length) && <InfoCard title="Allergenhinweis">
        {risk.contains.length ? `Enthält von dir ausgewählte Allergene: ${displayList(risk.contains)}. ` : ""}
        {risk.traces.length ? `Kann von dir ausgewählte Allergene enthalten: ${displayList(risk.traces)}.` : ""}
      </InfoCard>}
      {hasDiscoveryPreferences(saved) && <Text style={ui.small}>
        {matchesPreferences(product, saved) ? "Passt zu deinen gespeicherten Ernährungseinstellungen; keine aufgeführten Allergenkonflikte. Dies garantiert keine Eignung bei Allergien." : "Die Übereinstimmung mit allen Einstellungen ist nicht bestätigt. Quellenangaben können widersprüchlich oder unvollständig sein."}
      </Text>}
      <SectionCard title={`Nährwerte je ${product.nutritionBasis === "100ml" ? "100 ml" : "100 g"} · im Verkaufszustand`}>
        <ProductEstimateNotice product={product} />
        {([
          ["Kalorien", product.caloriesPer100g, "kcal"], ["Eiweiß", product.proteinPer100g, "g"],
          ["Kohlenhydrate", product.carbohydratesPer100g, "g"], ["Fett", product.fatPer100g, "g"],
          ["Ballaststoffe", product.fiberPer100g, "g"], ["Zucker", product.sugarsPer100g, "g"], ["Salz", product.saltPer100g, "g"],
        ] as const).map(([label, value, unit]) => <PreferenceRow key={label} label={label} value={value === null ? "Nicht angegeben" : `${formatNumber(value, 3)} ${unit}`} />)}
        {product.nutritionGrade && <PreferenceRow label="Nährwertbewertung (Nutri-Score)" value={product.nutritionGrade.toUpperCase()} />}
      </SectionCard>
      <SectionCard title="Zutaten"><Text style={ui.body}>{product.ingredientsText ?? "Die Quelle enthält keine Zutatenangaben."}</Text></SectionCard>
      <SectionCard title="Allergene">
        <PreferenceRow label="Enthält laut Angabe" value={product.allergens.length ? displayList(product.allergens) : "Keine aufgeführt; Allergenfreiheit nicht bestätigt"} />
        <PreferenceRow label="Kann laut Angabe enthalten" value={product.mayContainAllergens.length ? displayList(product.mayContainAllergens) : "Keine Spurenhinweise aufgeführt"} />
        <Text style={ui.small}>Quellenangaben können unvollständig sein. Prüfe Zutaten und Spurenhinweise auf der aktuellen Verpackung. Laktosefrei bedeutet nicht milchfrei.</Text>
      </SectionCard>
      <SectionCard title="Ernährungsangaben">
        {dietaryFields.map(field => <PreferenceRow key={field} label={dietaryNames[field]}
          value={product[field] === null ? "Unbekannt" : product[field] ? "Laut Quellenangabe" : "Nicht als geeignet ausgewiesen"} />)}
        {!!product.labels.filter(l => !l.startsWith('smartbasket:demo:')).length && <Text style={ui.small}>Kennzeichnungen der Quelle: {product.labels.filter(l => !l.startsWith('smartbasket:demo:')).join(", ")}</Text>}
      </SectionCard>
      <CatalogAttribution sources={[product.source]} />
      {product.sourceUrl && <TextButton label="Produkt auf der Quellwebsite ansehen" onPress={() => openCatalogLink(product.sourceUrl!)} />}
      <Text style={ui.caption}>Katalog aktualisiert {new Date(product.updatedAt).toLocaleDateString('de-DE')}{product.barcode ? ` · Strichcode ${product.barcode}` : ""}</Text>
    </>}
  </Screen>;
}
