import { germanSavedName } from '../lib/legacy-display';
import { formatDecimal, formatNumber, formatEuro } from '../lib/german';
import { ProductImage } from './ProductImage';
import { ProductEstimateNotice } from './ProductEstimateNotice';
import { planNutrition } from '../services/meals/planner';
import { mealNutritionKnown } from '../services/meals/choices';
import { ConfirmedMeals } from './ConfirmedMeals';
import { ParticipantNutrition } from './ParticipantNutrition';
import { BasketProductHeading } from './BasketProductHeading';
import { generalBasketNotes, productDietaryNotes } from '../lib/basket-notes';
import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { useState } from 'react';
import Feather from '@expo/vector-icons/Feather';
import { Chips, SectionCard, TextButton } from './ui';
import { CatalogAttribution } from './CatalogAttribution';
import { colors, spacing, ui } from '../lib/theme';
import { groupLabels } from '../services/basket/scoring';
import type { BasketGenerationResult } from '../types/basket';
import type { Product } from '../types/product';
import type { UserPreferences } from '../types/preferences';
import { replacementCandidatesForItem, replacementCandidatesForRequirement } from '../services/basket/replacements';
const number = (value: number) => Math.round(value).toLocaleString('de-DE');
export const basketPrice = (price: number | null) => price === null ? "Schätzung nicht verfügbar" : `Ca. ${formatEuro(price)}`;
export function BasketResult({ result, catalog = [], preferences, onToggleProduct, onReplaceProduct, onAddReplacement }: { result: BasketGenerationResult; catalog?: Product[]; preferences?: UserPreferences; onToggleProduct?: (id: string) => void; onReplaceProduct?: (currentId: string, product: Product) => void; onAddReplacement?: (requirement: NonNullable<BasketGenerationResult['ingredientRequirements']>[number], product: Product) => void }) {
  const [replacing, setReplacing] = useState<string | null>(null);
  const generalNotes = generalBasketNotes(result);
  const choose = (key: string, action: () => void) => { action(); setReplacing(null); };
  const replacementButton = (key: string, label: string) => <TextButton label={replacing === key ? "Alternativen schließen" : label} onPress={() => setReplacing(replacing === key ? null : key)} />;
  const replacementOptions = (key: string, options: Product[], action: (product: Product) => void) => replacing === key ? <View style={{ gap: 6, padding: 8, borderRadius: 10, backgroundColor: colors.surface }}>
    <Text style={ui.caption}>Wähle ein anderes Produkt derselben Kategorie</Text>
    {!options.length && <Text style={ui.small}>Keine passenden Alternativen verfügbar.</Text>}
    {options.map(product => <TextButton key={product.id} label={`${product.name}${product.brand ? ` · ${product.brand}` : ''}${product.priceEstimate === null ? '' : ` · Ca. ${formatEuro(product.priceEstimate)}`}`} onPress={() => choose(key, () => action(product))} />)}
  </View> : null;
  return <>
    <SectionCard title="Warenkorbübersicht">
      <Text style={ui.heading}>{result.estimatedTotalPrice===null?"Schätzung nicht verfügbar":`Geschätzte Gesamtkosten ${formatEuro(result.estimatedTotalPrice)}`}</Text>
      {result.status === 'partial' && <Text style={ui.body}>{result.mealPlan ? "Einige Ernährungsziele oder geplante Einkäufe sind nicht vollständig abgedeckt. Details stehen bei den Mahlzeiten weiter unten." : "Unvollständiger Warenkorb: Einige Ziele sind nicht erreicht."}</Text>}
      {!result.items.length && <Text style={ui.body}>Keine passenden Produkte ausgewählt.</Text>}
      {result.estimatedTotalPrice === null && !!result.items.length && <Text style={ui.small}>Im Katalog fehlen Preise. Zwischensumme der bekannten Preise: €{formatDecimal(result.knownPriceSubtotal, 2)}; dies ist nicht der Gesamtpreis des Warenkorbs.</Text>}
      {result.mealPlan ? <><Text style={ui.subheading}>Geplante Mahlzeiten · einschließlich Snacks</Text><ParticipantNutrition plan={result.mealPlan} nutrition={planNutrition(result.mealPlan)} daily />
        {result.mealPlan.items.some(i=>!mealNutritionKnown(i)) && <Text style={ui.small}>Durchschnittswerte berücksichtigen nur erfasste Mahlzeiten. Für auswärtiges Essen und Fertiggerichte ohne Produktzuordnung sind Nährwerte und Kosten unbekannt.</Text>}
        <Text style={ui.caption}>Durch den Einkauf abgedeckt: {Math.round(result.calorieCoveragePercent)}% des Kalorienziels · {Math.round(result.proteinCoveragePercent)}% des Eiweißziels. Fehlende oder abgewählte Lebensmittel verändern die geplanten Mahlzeiten nicht.</Text></> : <>
        <Text style={ui.body}>{number(result.totalCalories)} kcal · {number(result.totalProtein)}   g Eiweiß</Text>
        <Text style={ui.small}>Kalorien: {result.calorieCoveragePercent}% von {number(result.calorieTarget)} kcal</Text>
        <Text style={ui.small}>Eiweiß: {result.proteinCoveragePercent}% von {number(result.proteinTarget)} g</Text>
      </>}
      {result.budgetTarget !== null && <Text style={ui.small}>Budget für den Zeitraum: €{formatDecimal(result.budgetTarget, 2)} · {result.budgetDifference!==null?`Geschätzt ${formatEuro(Math.abs(result.budgetDifference))} ${result.budgetDifference>0?'über dem':'unter dem'} Budget`:'Budgetvergleich nicht verfügbar'}</Text>}
      {result.engineVersion !== '2' && <Text style={ui.caption}>Die Packungsnährwerte sind Planungssummen, keine Zusage zur täglichen Nahrungsaufnahme. Verfügbare Preise sind Schätzungen.</Text>}
    </SectionCard>
    {!!result.categoryCoverage.length && <SectionCard title="Abgedeckte Kategorien">
      <Chips labels={result.categoryCoverage.map(c => `${c.represented ? '✓' : '—'} ${groupLabels[c.group] ?? c.group}${c.required ? " · Grundbedarf" : ''}`)} />
    </SectionCard>}
    {result.remaining && <SectionCard title="Eingekauft und eingeplant"><Text style={ui.body}>{number(result.remaining.totalPurchasedWeight)}  g eingekauft · {number(result.remaining.totalPlannedConsumption)}  g eingeplant · {number(result.remaining.totalLeftoverWeight)}  g für später übrig</Text><Text style={ui.small}>Verbleibende Menge: {result.remaining.estimatedWastePercent}%. Diese Menge kann später verwendet werden.</Text>{result.remaining.totalPurchasedVolume>0 && <Text style={ui.small}>{number(result.remaining.totalPurchasedVolume)}  ml eingekauft · {number(result.remaining.totalPlannedVolume)}  ml eingeplant · {number(result.remaining.totalLeftoverVolume)}  ml für später übrig</Text>}</SectionCard>}
    {result.mealPlan?.participants&&<SectionCard title="Personen in diesem Plan">{result.mealPlan.participants.map(p=><Text key={p.id} style={ui.small}>{p.name}: {[...p.dietaryPreferences,...p.allergens,...p.intolerances].join(', ')}</Text>)}<Text style={ui.caption}>Ein gemeinsamer Speiseplan berücksichtigt die Einschränkungen aller Personen.</Text></SectionCard>}
    {result.mealPlan && <ConfirmedMeals plan={result.mealPlan} />}
    {!!result.ingredientRequirements?.some(r => !result.items.some(i => i.ingredientKey === r.ingredientKey) && (result.pantryUsed??[]).filter(u=>u.ingredientKey===r.ingredientKey).reduce((n,u)=>n+u.quantity,0)<r.requiredQuantity-.001) && <SectionCard title="Fehlende Zutaten">
      {result.ingredientRequirements.filter(r => !result.items.some(i => i.ingredientKey === r.ingredientKey) && (result.pantryUsed??[]).filter(u=>u.ingredientKey===r.ingredientKey).reduce((n,u)=>n+u.quantity,0)<r.requiredQuantity-.001).map(r => <View key={r.ingredientKey} style={{ gap: 4 }}>
        <Text style={ui.body}>{germanSavedName(r.ingredientName)} · {Math.round(r.requiredQuantity)} {r.unit}</Text>
        <Text style={ui.caption}>{result.removedIngredientKeys?.includes(r.ingredientKey) ? "Vom Einkauf abgewählt" : "Kein passendes Produkt ausgewählt"}  · nicht im Einkaufspreis enthalten</Text>
        {preferences && onAddReplacement && replacementButton(`ingredient:${r.ingredientKey}`, "Alternative aus der Kategorie suchen")}
        {preferences && onAddReplacement && replacementOptions(`ingredient:${r.ingredientKey}`, replacementCandidatesForRequirement(r, catalog, preferences), product => onAddReplacement(r, product))}
      </View>)}
    </SectionCard>}
    {!!generalNotes.length && <SectionCard title="Hinweise zur Planung">
      {generalNotes.map(w => <Text key={w.code} style={ui.small}>{w.message}</Text>)}
    </SectionCard>}
    {!!result.pantryUsed?.length && <SectionCard title="Aus deinen Vorräten">
      <Text style={ui.small}>Für diesen Plan verwendet, statt neu gekauft</Text>
      {result.pantryUsed.map(item => <View key={`${item.lotId}:${item.ingredientKey}`} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
        <Text style={[ui.body, { flex: 1 }]}>{item.name}</Text>
        <Text style={ui.subheading}>{item.quantity.toLocaleString('de-DE', { maximumFractionDigits: 1 })} {item.unit}</Text>
      </View>)}
    </SectionCard>}
    {[...result.items, ...(result.excludedItems ?? [])].map(item => <View key={item.product.id} style={onToggleProduct ? { paddingTop: 16, paddingRight: 16 } : undefined}>
      <SectionCard>
      {result.excludedItems?.some(i => i.product.id === item.product.id) && <Text style={ui.small}>Abgewählt · nicht im Warenkorbpreis enthalten</Text>}
      {item.isExtra && <Text style={ui.eyebrow}>Extra · zusätzlich zum Speiseplan</Text>}
      <BasketProductHeading name={item.product.name} subtitle={<Text style={ui.small}><Text style={{ fontWeight: '700' }}>{item.product.brand ?? "Marke nicht verfügbar"}</Text>{item.estimatedPrice !== null ? ` · ${formatEuro((item.estimatedPrice/item.packageCount))} pro Packung` : ''} · {item.packageCount} × {!item.quantityAssumed && item.product.quantityLabel ? item.product.quantityLabel : `${formatNumber(item.packageAmount, 2)} ${item.quantityUnit}`}{item.quantityAssumed ? " (geschätzte Packung)" : ''}</Text>} notes={productDietaryNotes(result.warnings, item)} report={item.reasonSelected.filter(reason => reason.code !== 'package_fit')} />
      <View style={{ flexDirection: 'row', alignItems: 'stretch', minHeight: 160, gap: spacing.lg }}>
        <View style={{ flex: 1, flexBasis: 0, minWidth: 0 }}>
          <ProductImage large fill uri={item.product.displayImageUrl} width={item.product.imageWidth} height={item.product.imageHeight} name={item.product.name} />
        </View>
        <View style={{ flex: 1, flexBasis: 0, minWidth: 0, gap: spacing.sm }}>
          <Text style={ui.small}>{item.isExtra ? `${item.product.caloriesPer100g ?? '—'} kcal · ${item.product.proteinPer100g ?? '—'} g Eiweiß / ${item.product.nutritionBasis === '100ml' ? '100 ml' : '100 g'}` : `${number(item.totalCalories)} kcal · ${number(item.totalProtein)}  g Eiweiß`}</Text>
          {!item.isExtra && item.plannedConsumptionQuantity !== undefined && <>
            <Text style={ui.small}>Eingeplant: {number(item.plannedConsumptionQuantity)} {item.quantityUnit}</Text>
            <Text style={ui.small}>Für später übrig: {number(item.leftoverQuantity??0)} {item.quantityUnit}</Text>
          </>}
          <Text style={ui.small}>{item.estimatedPrice === null ? "Preis nicht verfügbar" : `${formatEuro(item.estimatedPrice)} gesamt für diesen Artikel`}</Text>
        </View>
      </View>
      <TextButton label="Produkt ansehen" onPress={() => router.push({ pathname: '/product/[id]', params: { id: item.product.id } })} />
      {!result.excludedItems?.some(i => i.product.id === item.product.id) && preferences && onReplaceProduct && replacementButton(`product:${item.product.id}`, "Produkt austauschen")}
      {!result.excludedItems?.some(i => i.product.id === item.product.id) && preferences && onReplaceProduct && replacementOptions(`product:${item.product.id}`, replacementCandidatesForItem(item, catalog, preferences), product => onReplaceProduct(item.product.id, product))}
      <ProductEstimateNotice product={item.product} />
      </SectionCard>
      {onToggleProduct && <Pressable accessibilityRole="checkbox" accessibilityLabel={`Auswählen: ${item.product.name}`}
        accessibilityState={{ checked: result.items.some(i => i.product.id === item.product.id) }}
        onPress={() => onToggleProduct(item.product.id)}
        style={{ position: 'absolute', top: 0, right: 0, zIndex: 1, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ width: 28, height: 28, borderRadius: 4, borderWidth: 2, borderColor: colors.primary, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }}>
          {result.items.some(i => i.product.id === item.product.id) && <Feather name="check" size={20} color={colors.primary} />}
        </View>
      </Pressable>}
    </View>)}
    {!!result.items.length && <CatalogAttribution sources={[...new Set(result.items.map(i => i.product.source))]} />}
  </>;
}
