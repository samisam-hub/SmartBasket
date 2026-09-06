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
  return <>
    <SectionCard title="Basket summary">
      <Text style={ui.heading}>{basketPrice(result.estimatedTotalPrice)}</Text>
      {result.status === 'partial' && <Text style={ui.body}>Partial basket: some targets are unmet.</Text>}
      {!result.items.length && <Text style={ui.body}>No eligible products were selected.</Text>}
      {result.estimatedTotalPrice === null && !!result.items.length && <Text style={ui.small}>The catalog has missing prices. Known-price subtotal: €{result.knownPriceSubtotal.toFixed(2)}; this is not the basket total.</Text>}
      <Text style={ui.body}>{number(result.totalCalories)} kcal · {number(result.totalProtein)} g protein</Text>
      <Text style={ui.small}>Calories: {result.calorieCoveragePercent}% of {number(result.calorieTarget)} kcal</Text>
      <Text style={ui.small}>Protein: {result.proteinCoveragePercent}% of {number(result.proteinTarget)} g</Text>
      <Text style={ui.small}>{result.proteinRule}</Text>
      <Text style={ui.small}>{result.items.length} products · {result.items.reduce((sum, i) => sum + i.packageCount, 0)} packages · Plan fit {result.score}/100</Text>
      {result.budgetTarget !== null && <Text style={ui.small}>Period budget: €{result.budgetTarget.toFixed(2)} · {result.budgetStatus.replace(/_/g, ' ')}{result.budgetDifference !== null ? ` · difference ${result.budgetDifference >= 0 ? '+' : '−'}€${Math.abs(result.budgetDifference).toFixed(2)}` : ''}</Text>}
      <Text style={ui.caption}>Package nutrition is a planning total, not a meal plan or a promise of daily intake. Prices, where available, are estimates.</Text>
    </SectionCard>
    <SectionCard title="Category coverage">
      <Chips labels={result.categoryCoverage.map(c => `${c.represented ? '✓' : '—'} ${groupLabels[c.group] ?? c.group}${c.required ? ' · core' : ''}`)} />
    </SectionCard>
    {!!result.warnings.length && <SectionCard title="Planning notes">
      {result.warnings.map(w => <Text key={w.code} style={ui.small}>{w.message}</Text>)}
    </SectionCard>}
    {result.items.map(item => <SectionCard key={item.product.id} title={item.product.name}>
      <Text style={ui.small}>{item.product.brand ?? 'Brand unavailable'}</Text>
      <Text style={ui.body}>{item.packageCount} × {!item.quantityAssumed && item.product.quantityLabel ? item.product.quantityLabel : `${Number(item.packageAmount.toFixed(2))} ${item.quantityUnit}`}{item.quantityAssumed ? ' (assumed package)' : ''}</Text>
      <Text style={ui.small}>{number(item.totalCalories)} kcal · {number(item.totalProtein)} g protein · {basketPrice(item.estimatedPrice)}</Text>
      <View style={ui.stack}>{item.reasonSelected.slice(0, 3).map(reason => <Text key={reason.code} style={ui.caption}>{reason.detail}</Text>)}</View>
      <TextButton label="View product" onPress={() => router.push({ pathname: '/product/[id]', params: { id: item.product.id } })} />
    </SectionCard>)}
    {!!result.items.length && <CatalogAttribution sources={[...new Set(result.items.map(i => i.product.source))]} />}
  </>;
}
