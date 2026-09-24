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
import Feather from '@expo/vector-icons/Feather';
import { Chips, SectionCard, TextButton } from './ui';
import { CatalogAttribution } from './CatalogAttribution';
import { colors, spacing, ui } from '../lib/theme';
import { groupLabels } from '../services/basket/scoring';
import type { BasketGenerationResult } from '../types/basket';
const number = (value: number) => Math.round(value).toLocaleString('en-GB');
export const basketPrice = (price: number | null) => price === null ? 'Estimate unavailable' : `Est. €${price.toFixed(2)}`;
export function BasketResult({ result, onRemoveProduct }: { result: BasketGenerationResult; onRemoveProduct?: (id: string) => void }) {
  const generalNotes = generalBasketNotes(result);
  return <>
    <SectionCard title="Basket summary">
      <Text style={ui.heading}>{result.estimatedTotalPrice===null?'Estimate unavailable':`Estimated total €${result.estimatedTotalPrice.toFixed(2)}`}</Text>
      {result.status === 'partial' && <Text style={ui.body}>{result.mealPlan ? 'Some nutrition targets or planned purchases are not fully covered. See the meal details below.' : 'Partial basket: some targets are unmet.'}</Text>}
      {!result.items.length && <Text style={ui.body}>No eligible products were selected.</Text>}
      {result.estimatedTotalPrice === null && !!result.items.length && <Text style={ui.small}>The catalog has missing prices. Known-price subtotal: €{result.knownPriceSubtotal.toFixed(2)}; this is not the basket total.</Text>}
      {result.mealPlan ? <><Text style={ui.subheading}>Planned meals · including snacks</Text><ParticipantNutrition plan={result.mealPlan} nutrition={planNutrition(result.mealPlan)} daily />
        {result.mealPlan.items.some(i=>!mealNutritionKnown(i)) && <Text style={ui.small}>Averages cover recorded meals only. Eating out and unmatched ready meals have unknown nutrition and spending.</Text>}
        <Text style={ui.caption}>Shopping coverage: {Math.round(result.calorieCoveragePercent)}% of calorie target · {Math.round(result.proteinCoveragePercent)}% of protein target. Missing or removed groceries do not change the planned meals.</Text></> : <>
        <Text style={ui.body}>{number(result.totalCalories)} kcal · {number(result.totalProtein)} g protein</Text>
        <Text style={ui.small}>Calories: {result.calorieCoveragePercent}% of {number(result.calorieTarget)} kcal</Text>
        <Text style={ui.small}>Protein: {result.proteinCoveragePercent}% of {number(result.proteinTarget)} g</Text>
      </>}
      {result.budgetTarget !== null && <Text style={ui.small}>Period budget: €{result.budgetTarget.toFixed(2)} · {result.budgetDifference!==null?`Estimated €${Math.abs(result.budgetDifference).toFixed(2)} ${result.budgetDifference>0?'over':'under'} budget`:result.budgetStatus.replace(/_/g,' ')}</Text>}
      {result.engineVersion !== '2' && <Text style={ui.caption}>Package nutrition is a planning total, not a meal plan or a promise of daily intake. Prices, where available, are estimates.</Text>}
    </SectionCard>
    {!!result.categoryCoverage.length && <SectionCard title="Category coverage">
      <Chips labels={result.categoryCoverage.map(c => `${c.represented ? '✓' : '—'} ${groupLabels[c.group] ?? c.group}${c.required ? ' · core' : ''}`)} />
    </SectionCard>}
    {result.remaining && <SectionCard title="Purchased and planned"><Text style={ui.body}>{number(result.remaining.totalPurchasedWeight)} g purchased · {number(result.remaining.totalPlannedConsumption)} g planned · {number(result.remaining.totalLeftoverWeight)} g left for later</Text><Text style={ui.small}>Remaining mass: {result.remaining.estimatedWastePercent}%. This may be used later.</Text>{result.remaining.totalPurchasedVolume>0 && <Text style={ui.small}>{number(result.remaining.totalPurchasedVolume)} ml purchased · {number(result.remaining.totalPlannedVolume)} ml planned · {number(result.remaining.totalLeftoverVolume)} ml left for later</Text>}</SectionCard>}
    {result.mealPlan?.participants&&<SectionCard title="People in this plan">{result.mealPlan.participants.map(p=><Text key={p.id} style={ui.small}>{p.name}: {[...p.dietaryPreferences,...p.allergens,...p.intolerances].join(', ')}</Text>)}<Text style={ui.caption}>One shared menu meets the combined restrictions.</Text></SectionCard>}
    {result.mealPlan && <ConfirmedMeals plan={result.mealPlan} />}
    {!!result.ingredientRequirements?.some(r => !result.items.some(i => i.ingredientKey === r.ingredientKey) && (result.pantryUsed??[]).filter(u=>u.ingredientKey===r.ingredientKey).reduce((n,u)=>n+u.quantity,0)<r.requiredQuantity-.001) && <SectionCard title="Still on your shopping list">
      {result.ingredientRequirements.filter(r => !result.items.some(i => i.ingredientKey === r.ingredientKey) && (result.pantryUsed??[]).filter(u=>u.ingredientKey===r.ingredientKey).reduce((n,u)=>n+u.quantity,0)<r.requiredQuantity-.001).map(r => <View key={r.ingredientKey} style={{ gap: 4 }}>
        <Text style={ui.body}>{r.ingredientName} · {Math.round(r.requiredQuantity)} {r.unit}</Text>
        <Text style={ui.caption}>{result.removedIngredientKeys?.includes(r.ingredientKey) ? 'Removed from purchases' : 'No matching product selected'} · excluded from purchase cost</Text>
      </View>)}
    </SectionCard>}
    {!!generalNotes.length && <SectionCard title="Planning notes">
      {generalNotes.map(w => <Text key={w.code} style={ui.small}>{w.message}</Text>)}
    </SectionCard>}
    {!!result.pantryUsed?.length && <SectionCard title="From your pantry">
      <Text style={ui.small}>Used for this plan instead of buying</Text>
      {result.pantryUsed.map(item => <View key={`${item.lotId}:${item.ingredientKey}`} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
        <Text style={[ui.body, { flex: 1 }]}>{item.name}</Text>
        <Text style={ui.subheading}>{item.quantity.toLocaleString('en-GB', { maximumFractionDigits: 1 })} {item.unit}</Text>
      </View>)}
    </SectionCard>}
    {result.items.map(item => <View key={item.product.id} style={onRemoveProduct ? { paddingTop: 16, paddingRight: 16 } : undefined}>
      <SectionCard>
      {item.isExtra && <Text style={ui.eyebrow}>Extra · outside the meal plan</Text>}
      <BasketProductHeading name={item.product.name} subtitle={<Text style={ui.small}><Text style={{ fontWeight: '700' }}>{item.product.brand ?? 'Brand unavailable'}</Text>{item.estimatedPrice !== null ? ` · €${(item.estimatedPrice/item.packageCount).toFixed(2)} per package` : ''} · {item.packageCount} × {!item.quantityAssumed && item.product.quantityLabel ? item.product.quantityLabel : `${Number(item.packageAmount.toFixed(2))} ${item.quantityUnit}`}{item.quantityAssumed ? ' (assumed package)' : ''}</Text>} notes={productDietaryNotes(result.warnings, item)} report={item.reasonSelected.filter(reason => reason.code !== 'package_fit')} />
      <View style={{ flexDirection: 'row', alignItems: 'stretch', minHeight: 160, gap: spacing.lg }}>
        <View style={{ flex: 1, flexBasis: 0, minWidth: 0 }}>
          <ProductImage large fill uri={item.product.displayImageUrl} width={item.product.imageWidth} height={item.product.imageHeight} name={item.product.name} />
        </View>
        <View style={{ flex: 1, flexBasis: 0, minWidth: 0, gap: spacing.sm }}>
          <Text style={ui.small}>{item.isExtra ? `${item.product.caloriesPer100g ?? '—'} kcal · ${item.product.proteinPer100g ?? '—'} g protein / ${item.product.nutritionBasis === '100ml' ? '100 ml' : '100 g'}` : `${number(item.totalCalories)} kcal · ${number(item.totalProtein)} g protein`}</Text>
          {!item.isExtra && item.plannedConsumptionQuantity !== undefined && <>
            <Text style={ui.small}>Planned: {number(item.plannedConsumptionQuantity)} {item.quantityUnit}</Text>
            <Text style={ui.small}>Left for later: {number(item.leftoverQuantity??0)} {item.quantityUnit}</Text>
          </>}
          <Text style={ui.small}>{item.estimatedPrice === null ? 'Price unavailable' : `€${item.estimatedPrice.toFixed(2)} item total`}</Text>
        </View>
      </View>
      <TextButton label="View product" onPress={() => router.push({ pathname: '/product/[id]', params: { id: item.product.id } })} />
      <ProductEstimateNotice product={item.product} />
      </SectionCard>
      {onRemoveProduct && <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${item.product.name}`}
        onPress={() => onRemoveProduct(item.product.id)}
        style={{ position: 'absolute', top: 0, right: 0, zIndex: 1, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: colors.surface, backgroundColor: colors.errorBackground, alignItems: 'center', justifyContent: 'center' }}>
          <Feather name="minus" size={20} color={colors.errorText} />
        </View>
      </Pressable>}
    </View>)}
    {!!result.items.length && <CatalogAttribution sources={[...new Set(result.items.map(i => i.product.source))]} />}
  </>;
}
