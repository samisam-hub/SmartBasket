import { formatEuro } from '../lib/german';
import { basketDisplayName } from '../services/basket/naming';
import { Pressable, Text, View } from 'react-native';
import { planNutrition } from '../services/meals/planner';
import { plannedDayCount } from '../services/meals/weekPlan';
import { splitNutrition } from '../services/meals/portions';
import type { SavedBasket } from '../types/basket';
import { colors, ui } from '../lib/theme';
import { basketPrice } from './BasketResult';
import { BasketMealPreview } from './BasketMealPreview';

export function SavedBasketPreview({ basket: b, onOpen, minimal = false }: { basket: SavedBasket; onOpen: () => void; minimal?: boolean }) {
  const date = new Date(b.createdAt);
  const suffix = `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}`;
  const name = basketDisplayName(b);
  const title = name.endsWith(` ${suffix}`) ? name : `${name} ${suffix}`;
  if (minimal && b.result.mealPlan?.items.length) {
    const plan = b.result.mealPlan;
    return <>
      <Pressable onPress={onOpen} accessibilityRole="button" accessibilityLabel={`Öffnen ${title}`} style={{ gap: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
          <Text style={[ui.subheading, { flexGrow: 1 }]}>{title}</Text>
          <Text style={[ui.body, { fontWeight: '700' }]}>{b.result.estimatedTotalPrice === null ? "Preis nicht verfügbar" : `${formatEuro(b.result.estimatedTotalPrice)}`}</Text>
        </View>
      </Pressable>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
        <View style={{ flex: 1, minWidth: 0 }}><BasketMealPreview plan={plan} onOpen={onOpen} showMealSlot={false} compact /></View>
        <View style={{ flex: 1, minWidth: 0, gap: 12, borderLeftWidth: 1, borderLeftColor: colors.border, paddingLeft: 12 }}>
          <Text style={ui.caption}>Tagesdurchschnitt</Text>
          {splitNutrition(plan, planNutrition(plan), Math.max(1, plannedDayCount(plan))).map((p, index) => <View key={p.id} style={{ gap: 4, ...(index ? { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12 } : {}) }}>
            <Text style={[ui.small, { fontWeight: '700', color: colors.ink }]}>{p.name}</Text>
            <Text style={ui.small}>{Math.round(p.calories)} kcal · {Math.round(p.protein)}   g Eiweiß</Text>
          </View>)}
        </View>
      </View>
    </>;
  }
  return <>
    <Pressable onPress={onOpen} accessibilityRole="button" accessibilityLabel={`Öffnen ${title}`} style={{ gap: 8 }}>
      <Text style={ui.subheading}>{title}</Text>
      {!minimal && <Text style={ui.small}>{b.result.items.length}  Produkte · {b.syncStatus === 'synced' ? "Synchronisiert" : "Auf diesem Gerät"}</Text>}
      <Text style={ui.body}>{minimal && b.result.estimatedTotalPrice !== null ? `${formatEuro(b.result.estimatedTotalPrice)}` : basketPrice(b.result.estimatedTotalPrice)}</Text>
    </Pressable>
    {b.result.mealPlan && <BasketMealPreview plan={b.result.mealPlan} onOpen={onOpen} showMealSlot={!minimal} />}
  </>;
}
