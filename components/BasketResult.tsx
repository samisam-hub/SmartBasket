import { ProductImage } from './ProductImage';
import { BasketProductHeading } from './BasketProductHeading';
import { generalBasketNotes, productDietaryNotes } from '../lib/basket-notes';
import { router } from 'expo-router';
import { Text, View } from 'react-native';
import { Chips, SectionCard, TextButton } from './ui';
import { CatalogAttribution } from './CatalogAttribution';
import { ui } from '../lib/theme';
import { groupLabels } from '../services/basket/scoring';
import type { BasketGenerationResult } from '../types/basket';
const number = (value: number) => Math.round(value).toLocaleString('en-GB');
export const basketPrice = (price: number | null) => price === null ? 'Estimate unavailable' : `Est. €${price.toFixed(2)}`;
export function BasketResult({ result }: { result: BasketGenerationResult }) {
  const generalNotes = generalBasketNotes(result);
  return <>
    <SectionCard title="Basket summary">
      <Text style={ui.heading}>{result.estimatedTotalPrice===null?'Estimate unavailable':`Estimated total €${result.estimatedTotalPrice.toFixed(2)}`}</Text>
      {result.status === 'partial' && <Text style={ui.body}>Partial basket: some targets are unmet.</Text>}
      {!result.items.length && <Text style={ui.body}>No eligible products were selected.</Text>}
      {result.estimatedTotalPrice === null && !!result.items.length && <Text style={ui.small}>The catalog has missing prices. Known-price subtotal: €{result.knownPriceSubtotal.toFixed(2)}; this is not the basket total.</Text>}
      <Text style={ui.body}>{number(result.totalCalories)} kcal · {number(result.totalProtein)} g protein</Text>
      <Text style={ui.small}>Calories: {result.calorieCoveragePercent}% of {number(result.calorieTarget)} kcal</Text>
      <Text style={ui.small}>Protein: {result.proteinCoveragePercent}% of {number(result.proteinTarget)} g</Text>
      <Text style={ui.small}>{result.proteinRule}</Text>
      <Text style={ui.small}>{result.items.length} products · {result.items.reduce((sum, i) => sum + i.packageCount, 0)} packages · Plan fit {result.score}/100</Text>
      {result.budgetTarget !== null && <Text style={ui.small}>Period budget: €{result.budgetTarget.toFixed(2)} · {result.budgetDifference!==null?`Estimated €${Math.abs(result.budgetDifference).toFixed(2)} ${result.budgetDifference>0?'over':'under'} budget`:result.budgetStatus.replace(/_/g,' ')}</Text>}
      <Text style={ui.caption}>{result.engineVersion === '2' ? 'Nutrition is calculated from planned ingredient consumption using curated estimates. Missing ingredients contribute no nutrition. Costs cover whole purchased packages.' : 'Package nutrition is a planning total, not a meal plan or a promise of daily intake. Prices, where available, are estimates.'}</Text>
    </SectionCard>
    {!!result.categoryCoverage.length && <SectionCard title="Category coverage">
      <Chips labels={result.categoryCoverage.map(c => `${c.represented ? '✓' : '—'} ${groupLabels[c.group] ?? c.group}${c.required ? ' · core' : ''}`)} />
    </SectionCard>}
    {result.remaining && <SectionCard title="Purchased and planned"><Text style={ui.body}>{number(result.remaining.totalPurchasedWeight)} g purchased · {number(result.remaining.totalPlannedConsumption)} g planned · {number(result.remaining.totalLeftoverWeight)} g left for later</Text><Text style={ui.small}>Remaining mass: {result.remaining.estimatedWastePercent}%. This may be used later.</Text>{result.remaining.totalPurchasedVolume>0 && <Text style={ui.small}>{number(result.remaining.totalPurchasedVolume)} ml purchased · {number(result.remaining.totalPlannedVolume)} ml planned · {number(result.remaining.totalLeftoverVolume)} ml left for later</Text>}</SectionCard>}
    {result.mealPlan?.participants&&<SectionCard title="People in this plan">{result.mealPlan.participants.map(p=><Text key={p.id} style={ui.small}>{p.name}: {p.dailyCalories} kcal · {p.proteinTarget} g protein/day · {[...p.dietaryPreferences,...p.allergens,...p.intolerances].join(', ')}</Text>)}<Text style={ui.caption}>One shared menu meets the combined restrictions. Individual portions are not assigned.</Text></SectionCard>}
    {result.mealPlan && <SectionCard title="Confirmed meals">{result.mealPlan.items.map(i=><Text key={i.id} style={ui.small}>Day {i.dayIndex+1} · {i.mealSlot}: {i.meal.name} · {i.servings} servings</Text>)}</SectionCard>}
    {!!generalNotes.length && <SectionCard title="Planning notes">
      {generalNotes.map(w => <Text key={w.code} style={ui.small}>{w.message}</Text>)}
    </SectionCard>}
    {result.items.map(item => <SectionCard key={item.product.id}>
      <BasketProductHeading name={item.product.name} notes={productDietaryNotes(result.warnings, item)} />
      <Text style={ui.small}><Text style={{ fontWeight: '700' }}>{item.product.brand ?? 'Brand unavailable'}</Text> · {item.packageCount} × {!item.quantityAssumed && item.product.quantityLabel ? item.product.quantityLabel : `${Number(item.packageAmount.toFixed(2))} ${item.quantityUnit}`}{item.quantityAssumed ? ' (assumed package)' : ''}</Text>
      <View style={{ alignItems: 'center' }}>
        <ProductImage uri={item.product.displayImageUrl} width={item.product.imageWidth} height={item.product.imageHeight} name={item.product.name} />
      </View>
      <Text style={ui.small}>{item.estimatedPrice === null ? 'Price unavailable' : `€${(item.estimatedPrice/item.packageCount).toFixed(2)} per package · €${item.estimatedPrice.toFixed(2)} item total`}</Text>
      <Text style={ui.small}>{number(item.totalCalories)} kcal · {number(item.totalProtein)} g protein</Text>
      {item.plannedConsumptionQuantity !== undefined && <Text style={ui.small}>Planned: {number(item.plannedConsumptionQuantity)} {item.quantityUnit} · Left for later: {number(item.leftoverQuantity??0)} {item.quantityUnit}</Text>}
      <View style={ui.stack}>{item.reasonSelected.slice(0, 3).map(reason => <Text key={reason.code} style={ui.caption}>{reason.detail}</Text>)}</View>
      <TextButton label="View product" onPress={() => router.push({ pathname: '/product/[id]', params: { id: item.product.id } })} />
    </SectionCard>)}
    {!!result.items.length && <CatalogAttribution sources={[...new Set(result.items.map(i => i.product.source))]} />}
  </>;
}
