import { Pressable, Text, View } from 'react-native';
import { planNutrition } from '../services/meals/planner';
import { splitNutrition } from '../services/meals/portions';
import type { SavedBasket } from '../types/basket';
import { colors, ui } from '../lib/theme';
import { basketPrice } from './BasketResult';
import { BasketMealPreview } from './BasketMealPreview';

export function SavedBasketPreview({ basket: b, onOpen, minimal = false }: { basket: SavedBasket; onOpen: () => void; minimal?: boolean }) {
  const date = new Date(b.createdAt);
  const suffix = `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}`;
  const title = b.name.endsWith(` ${suffix}`) ? b.name : `${b.name} ${suffix}`;
  if (minimal && b.result.mealPlan?.items.length) {
    const plan = b.result.mealPlan;
    return <>
      <Pressable onPress={onOpen} accessibilityRole="button" accessibilityLabel={`Open ${title}`} style={{ gap: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
          <Text style={[ui.subheading, { flexGrow: 1 }]}>{title}</Text>
          <Text style={[ui.body, { fontWeight: '700' }]}>{b.result.estimatedTotalPrice === null ? 'Price unavailable' : `€${b.result.estimatedTotalPrice.toFixed(2)}`}</Text>
        </View>
      </Pressable>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
        <View style={{ flex: 1, minWidth: 0 }}><BasketMealPreview plan={plan} onOpen={onOpen} showMealSlot={false} compact /></View>
        <View style={{ flex: 1, minWidth: 0, gap: 12, borderLeftWidth: 1, borderLeftColor: colors.border, paddingLeft: 12 }}>
          <Text style={ui.caption}>Daily averages</Text>
          {splitNutrition(plan, planNutrition(plan), plan.planningDays).map((p, index) => <View key={p.id} style={{ gap: 4, ...(index ? { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12 } : {}) }}>
            <Text style={[ui.small, { fontWeight: '700', color: colors.ink }]}>{p.name}</Text>
            <Text style={ui.small}>{Math.round(p.calories)} kcal · {Math.round(p.protein)} g protein</Text>
          </View>)}
        </View>
      </View>
    </>;
  }
  return <>
    <Pressable onPress={onOpen} accessibilityRole="button" accessibilityLabel={`Open ${title}`} style={{ gap: 8 }}>
      <Text style={ui.subheading}>{title}</Text>
      {!minimal && <Text style={ui.small}>{b.result.items.length} products · {b.syncStatus === 'synced' ? 'Synced' : 'On this device'}</Text>}
      <Text style={ui.body}>{minimal && b.result.estimatedTotalPrice !== null ? `€${b.result.estimatedTotalPrice.toFixed(2)}` : basketPrice(b.result.estimatedTotalPrice)}</Text>
    </Pressable>
    {b.result.mealPlan && <BasketMealPreview plan={b.result.mealPlan} onOpen={onOpen} showMealSlot={!minimal} />}
  </>;
}
