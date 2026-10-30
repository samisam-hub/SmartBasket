import { formatMoney, formatNumber, groupLabel, t } from '../services/i18n';
import { contentName } from '../services/i18n/content';
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
import type { BasketGenerationResult } from '../types/basket';
import type { Product } from '../types/product';
import type { UserPreferences } from '../types/preferences';
import { replacementCandidatesForItem, replacementCandidatesForRequirement } from '../services/basket/replacements';
const number = (value: number) => formatNumber(Math.round(value));
export const basketPrice = (price: number | null) => price === null ? t('result.noEstimate') : t('result.estimate', { price: formatMoney(price) });
export function BasketResult({ result, catalog = [], preferences, onToggleProduct, onReplaceProduct, onAddReplacement }: { result: BasketGenerationResult; catalog?: Product[]; preferences?: UserPreferences; onToggleProduct?: (id: string) => void; onReplaceProduct?: (currentId: string, product: Product) => void; onAddReplacement?: (requirement: NonNullable<BasketGenerationResult['ingredientRequirements']>[number], product: Product) => void }) {
  const [replacing, setReplacing] = useState<string | null>(null);
  const generalNotes = generalBasketNotes(result);
  const choose = (key: string, action: () => void) => { action(); setReplacing(null); };
  const replacementButton = (key: string, label: string) => <TextButton label={replacing === key ? t('result.closeAlternatives') : label} onPress={() => setReplacing(replacing === key ? null : key)} />;
  const replacementOptions = (key: string, options: Product[], action: (product: Product) => void) => replacing === key ? <View style={{ gap: 6, padding: 8, borderRadius: 10, backgroundColor: colors.surface }}>
    <Text style={ui.caption}>{t('result.pickOther')}</Text>
    {!options.length && <Text style={ui.small}>{t('result.noAlternatives')}</Text>}
    {options.map(product => <TextButton key={product.id} label={`${product.name}${product.brand ? ` · ${product.brand}` : ''}${product.priceEstimate === null ? '' : ` · Ca. ${formatMoney(product.priceEstimate)}`}`} onPress={() => choose(key, () => action(product))} />)}
  </View> : null;
  return <>
    <SectionCard title={t('result.overview')}>
      <Text style={ui.heading}>{result.estimatedTotalPrice===null?t('result.noEstimate'):t('result.totalEstimate', { price: formatMoney(result.estimatedTotalPrice) })}</Text>
      {result.status === 'partial' && <Text style={ui.body}>{result.mealPlan ? t('result.partialPlan') : t('result.partial')}</Text>}
      {!result.items.length && <Text style={ui.body}>{t('result.noProducts')}</Text>}
      {result.estimatedTotalPrice === null && !!result.items.length && <Text style={ui.small}>{t('result.missingPrices', { subtotal: formatMoney(result.knownPriceSubtotal) })}</Text>}
      {result.mealPlan ? <><Text style={ui.subheading}>{t('result.plannedMeals')}</Text><ParticipantNutrition plan={result.mealPlan} nutrition={planNutrition(result.mealPlan)} daily />
        {result.mealPlan.items.some(i=>!mealNutritionKnown(i)) && <Text style={ui.small}>{t('result.averagesNote')}</Text>}
        <Text style={ui.caption}>{t('result.coverage', { calories: Math.round(result.calorieCoveragePercent), protein: Math.round(result.proteinCoveragePercent) })}</Text></> : <>
        <Text style={ui.body}>{t('result.caloriesProtein', { calories: number(result.totalCalories), protein: number(result.totalProtein) })}</Text>
        <Text style={ui.small}>{t('result.caloriesLine', { percent: result.calorieCoveragePercent, target: number(result.calorieTarget) })}</Text>
        <Text style={ui.small}>{t('result.proteinLine', { percent: result.proteinCoveragePercent, target: number(result.proteinTarget) })}</Text>
      </>}
      {result.budgetTarget !== null && <Text style={ui.small}>{t('result.budgetLine', { budget: formatMoney(result.budgetTarget),
        comparison: result.budgetDifference!==null
          ? t('result.budgetDiff', { amount: formatMoney(Math.abs(result.budgetDifference)), direction: t(result.budgetDifference>0?'result.over':'result.under') })
          : t('result.budgetUnknown') })}</Text>}
      {result.engineVersion !== '2' && <Text style={ui.caption}>{t('result.packageNote')}</Text>}
    </SectionCard>
    {!!result.categoryCoverage.length && <SectionCard title={t('result.categories')}>
      <Chips labels={result.categoryCoverage.map(c => `${c.represented ? '✓' : '—'} ${groupLabel(c.group) ?? c.group}${c.required ? t('result.basicNeed') : ''}`)} />
    </SectionCard>}
    {result.remaining && <SectionCard title={t('result.boughtPlanned')}><Text style={ui.body}>{t('result.remainingWeight', { bought: number(result.remaining.totalPurchasedWeight), planned: number(result.remaining.totalPlannedConsumption), leftover: number(result.remaining.totalLeftoverWeight) })}</Text><Text style={ui.small}>{t('result.remainingShare', { percent: result.remaining.estimatedWastePercent })}</Text>{result.remaining.totalPurchasedVolume>0 && <Text style={ui.small}>{t('result.remainingVolume', { bought: number(result.remaining.totalPurchasedVolume), planned: number(result.remaining.totalPlannedVolume), leftover: number(result.remaining.totalLeftoverVolume) })}</Text>}</SectionCard>}
    {result.mealPlan?.participants&&<SectionCard title={t('result.peopleInPlan')}>{result.mealPlan.participants.map(p=><Text key={p.id} style={ui.small}>{p.name}: {[...p.dietaryPreferences,...p.allergens,...p.intolerances].join(', ')}</Text>)}<Text style={ui.caption}>{t('result.sharedPlanNote')}</Text></SectionCard>}
    {result.mealPlan && <ConfirmedMeals plan={result.mealPlan} />}
    {!!result.ingredientRequirements?.some(r => !result.items.some(i => i.ingredientKey === r.ingredientKey) && (result.pantryUsed??[]).filter(u=>u.ingredientKey===r.ingredientKey).reduce((n,u)=>n+u.quantity,0)<r.requiredQuantity-.001) && <SectionCard title={t('result.missingIngredients')}>
      {result.ingredientRequirements.filter(r => !result.items.some(i => i.ingredientKey === r.ingredientKey) && (result.pantryUsed??[]).filter(u=>u.ingredientKey===r.ingredientKey).reduce((n,u)=>n+u.quantity,0)<r.requiredQuantity-.001).map(r => <View key={r.ingredientKey} style={{ gap: 4 }}>
        <Text style={ui.body}>{contentName(r.ingredientName)} · {Math.round(r.requiredQuantity)} {r.unit}</Text>
        <Text style={ui.caption}>{result.removedIngredientKeys?.includes(r.ingredientKey) ? t('result.unchecked') : t('result.noMatch')}{t('result.notInPrice')}</Text>
        {preferences && onAddReplacement && replacementButton(`ingredient:${r.ingredientKey}`, t('result.findAlternative'))}
        {preferences && onAddReplacement && replacementOptions(`ingredient:${r.ingredientKey}`, replacementCandidatesForRequirement(r, catalog, preferences), product => onAddReplacement(r, product))}
      </View>)}
    </SectionCard>}
    {!!generalNotes.length && <SectionCard title={t('result.planningNotes')}>
      {generalNotes.map(w => <Text key={w.code} style={ui.small}>{w.message}</Text>)}
    </SectionCard>}
    {!!result.pantryUsed?.length && <SectionCard title={t('result.fromPantry')}>
      <Text style={ui.small}>{t('result.fromPantryNote')}</Text>
      {result.pantryUsed.map(item => <View key={`${item.lotId}:${item.ingredientKey}`} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
        <Text style={[ui.body, { flex: 1 }]}>{item.name}</Text>
        <Text style={ui.subheading}>{formatNumber(item.quantity, 1)} {item.unit}</Text>
      </View>)}
    </SectionCard>}
    {[...result.items, ...(result.excludedItems ?? [])].map(item => <View key={item.product.id} style={onToggleProduct ? { paddingTop: 16, paddingRight: 16 } : undefined}>
      <SectionCard>
      {result.excludedItems?.some(i => i.product.id === item.product.id) && <Text style={ui.small}>{t('result.excluded')}</Text>}
      {item.isExtra && <Text style={ui.eyebrow}>{t('result.extra')}</Text>}
      <BasketProductHeading name={item.product.name} subtitle={<Text style={ui.small}><Text style={{ fontWeight: '700' }}>{item.product.brand ?? t('result.noBrand')}</Text>{item.estimatedPrice !== null ? t('result.perPackage', { price: formatMoney(item.estimatedPrice/item.packageCount) }) : ''} · {item.packageCount} × {!item.quantityAssumed && item.product.quantityLabel ? item.product.quantityLabel : `${formatNumber(item.packageAmount, 2)} ${item.quantityUnit}`}{item.quantityAssumed ? t('result.assumedPackage') : ''}</Text>} notes={productDietaryNotes(result.warnings, item)} report={item.reasonSelected.filter(reason => reason.code !== 'package_fit')} />
      <View style={{ flexDirection: 'row', alignItems: 'stretch', minHeight: 160, gap: spacing.lg }}>
        <View style={{ flex: 1, flexBasis: 0, minWidth: 0 }}>
          <ProductImage large fill uri={item.product.displayImageUrl} width={item.product.imageWidth} height={item.product.imageHeight} name={item.product.name} />
        </View>
        <View style={{ flex: 1, flexBasis: 0, minWidth: 0, gap: spacing.sm }}>
          <Text style={ui.small}>{item.isExtra
            ? t('result.nutritionPer100', { calories: item.product.caloriesPer100g ?? '—', protein: item.product.proteinPer100g ?? '—', basis: item.product.nutritionBasis === '100ml' ? '100 ml' : '100 g' })
            : t('result.caloriesProtein', { calories: number(item.totalCalories), protein: number(item.totalProtein) })}</Text>
          {!item.isExtra && item.plannedConsumptionQuantity !== undefined && <>
            <Text style={ui.small}>{t('result.planned', { amount: number(item.plannedConsumptionQuantity), unit: item.quantityUnit })}</Text>
            <Text style={ui.small}>{t('result.leftover', { amount: number(item.leftoverQuantity??0), unit: item.quantityUnit })}</Text>
          </>}
          <Text style={ui.small}>{item.estimatedPrice === null ? t('result.noPrice') : t('result.itemTotal', { price: formatMoney(item.estimatedPrice) })}</Text>
        </View>
      </View>
      <TextButton label={t('result.viewProduct')} onPress={() => router.push({ pathname: '/product/[id]', params: { id: item.product.id } })} />
      {!result.excludedItems?.some(i => i.product.id === item.product.id) && preferences && onReplaceProduct && replacementButton(`product:${item.product.id}`, t('result.replaceProduct'))}
      {!result.excludedItems?.some(i => i.product.id === item.product.id) && preferences && onReplaceProduct && replacementOptions(`product:${item.product.id}`, replacementCandidatesForItem(item, catalog, preferences), product => onReplaceProduct(item.product.id, product))}
      <ProductEstimateNotice product={item.product} />
      </SectionCard>
      {onToggleProduct && <Pressable accessibilityRole="checkbox" accessibilityLabel={t('result.select', { product: item.product.name })}
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
