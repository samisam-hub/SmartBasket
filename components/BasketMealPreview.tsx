import { useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import type { MealPlan } from '../types/meal';
import { colors, ui } from '../lib/theme';
import { MealImage } from './MealImage';

export function BasketMealPreview({ plan, onOpen, showMealSlot = true, compact = false, compactDetails }: { plan: MealPlan; onOpen: () => void; showMealSlot?: boolean; compact?: boolean; compactDetails?: { title: string; price: string } }) {
  const [width, setWidth] = useState(0), [active, setActive] = useState(0);
  const scroll = useRef<ScrollView>(null);
  const slots = ['breakfast', 'lunch', 'dinner', 'snack'];
  const firstDay = Math.min(...plan.items.map(i => i.dayIndex));
  const items = plan.items.filter(i => i.dayIndex === firstDay).sort((a, b) => slots.indexOf(a.mealSlot) - slots.indexOf(b.mealSlot));
  if (!items.length) return null;
  return <View onLayout={e => {
    const next = e.nativeEvent.layout.width;
    if (next > 0 && next !== width) { setWidth(next); scroll.current?.scrollTo({ x: next * active, animated: false }); }
  }} style={{ overflow: 'hidden' }}>
    {width > 0 && <ScrollView horizontal pagingEnabled ref={scroll} showsHorizontalScrollIndicator={false}
      scrollEventThrottle={16} onScroll={e => setActive(Math.max(0, Math.min(items.length - 1, Math.round(e.nativeEvent.contentOffset.x / width))))}>
      {items.map(item => <Pressable key={item.id} onPress={onOpen} accessibilityRole="button"
        accessibilityLabel={`Open basket: ${item.meal.name}`} style={{ width, gap: 8, paddingHorizontal: 4 }}>
        {showMealSlot && <Text style={ui.small}>Day 1 · {item.mealSlot}</Text>}
        {compactDetails ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
          <View style={{ flex: 1, minWidth: 0 }}><MealImage meal={item.meal} compact /></View>
          <View style={{ flex: 1, minWidth: 0, gap: 8 }}>
            <Text style={[ui.body, { fontWeight: '700', color: colors.ink }]}>{compactDetails.title}</Text>
            <Text style={[ui.body, { fontWeight: '700', color: colors.ink }]}>{compactDetails.price}</Text>
            <Text style={ui.small}>{item.meal.name}</Text>
          </View>
        </View> : <>
          <MealImage meal={item.meal} compact={compact} />
          <Text style={[compact ? ui.small : ui.body, { textAlign: 'center' }]}>{item.meal.name}</Text>
        </>}
      </Pressable>)}
    </ScrollView>}
    <View style={{ flexDirection: 'row', justifyContent: 'center', alignSelf: compactDetails ? 'flex-start' : 'stretch' }}>
      {items.map((item, index) => <Pressable key={item.id} accessibilityRole="button"
        accessibilityLabel={`Preview ${item.mealSlot}`} accessibilityState={{ selected: active === index }}
        onPress={() => scroll.current?.scrollTo({ x: index * width, animated: true })}
        style={{ width: compact ? undefined : 44, flex: compact ? 1 : undefined, height: 44, alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: active === index ? colors.primary : colors.border }} />
      </Pressable>)}
    </View>
  </View>;
}
