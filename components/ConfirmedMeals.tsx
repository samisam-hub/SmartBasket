import { useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import type { AnyMealPlan, AnyMealPlanItem } from '../types/meal';
import { mealNutrition } from '../services/meals/planner';
import { planDays } from '../services/meals/weekPlan';
import { mealNutritionKnown } from '../services/meals/choices';
import { colors, spacing, ui } from '../lib/theme';
import { MealImage } from './MealImage';
import { ParticipantNutrition } from './ParticipantNutrition';
import { SectionCard } from './ui';

const slots = ['breakfast', 'lunch', 'dinner', 'snack'];

function DayMeals({ plan, label, items, ratios }: { plan: AnyMealPlan; label: string; items: AnyMealPlanItem[]; ratios?: Record<string, number> }) {
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState(0);
  const scroll = useRef<ScrollView>(null);
  return <View style={{ gap: spacing.md, minWidth: 0 }}>
    <Text style={ui.subheading}>{label}</Text>
    <View onLayout={event => {
      const nextWidth = event.nativeEvent.layout.width;
      if (nextWidth > 0 && nextWidth !== width) {
        setWidth(nextWidth);
        scroll.current?.scrollTo({ x: active * nextWidth, animated: false });
      }
    }} style={{ overflow: 'hidden' }}>
      {width > 0 && <ScrollView ref={scroll} horizontal pagingEnabled showsHorizontalScrollIndicator={false}
        onScroll={event => setActive(Math.max(0, Math.min(items.length - 1, Math.round(event.nativeEvent.contentOffset.x / width))))}
        scrollEventThrottle={16}>
        {items.map((item, index) => <View key={item.id} accessibilityElementsHidden={active !== index}
          importantForAccessibility={active === index ? 'auto' : 'no-hide-descendants'}
          style={{ width, gap: spacing.sm, paddingHorizontal: spacing.xs }}>
          <Text style={ui.eyebrow}>{item.mealSlot.toUpperCase()}</Text>
          <Text style={ui.subheading}>{item.meal.name}</Text>
          <MealImage meal={item.meal} compact />
          {mealNutritionKnown(item, ratios) ? <ParticipantNutrition plan={plan} participantIds={item.participantIds} nutrition={mealNutrition(item, ratios)} /> : <Text style={ui.small}>Nutrition unknown{item.mealMode==='eat_out'?' · Eating out · No shopping items':' · No matched product'}</Text>}
          {item.readyMealMatch && (ratios?.[`ready:${item.readyMealMatch.productId}`]??1)>0 && <Text style={ui.small}>{item.readyMealMatch.productName}</Text>}
        </View>)}
      </ScrollView>}
    </View>
    <View style={{ flexDirection: 'row', justifyContent: 'center' }}>
      {items.map((item, index) => <Pressable key={item.id} accessibilityRole="button"
        accessibilityLabel={`${label}: ${item.mealSlot}`}
        accessibilityState={{ selected: active === index }}
        onPress={() => scroll.current?.scrollTo({ x: index * width, animated: true })}
        style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: active === index ? colors.primary : colors.border }} />
      </Pressable>)}
    </View>
  </View>;
}

export function ConfirmedMeals({ plan, ratios }: { plan: AnyMealPlan; ratios?: Record<string, number> }) {
  // Days nobody planned are left out instead of shown as an empty row.
  return <SectionCard title="Confirmed meals">
    {planDays(plan).filter(day => day.items.length).map(day => <DayMeals key={day.key} plan={plan} ratios={ratios}
      label={day.label} items={[...day.items].sort((a, b) => slots.indexOf(a.mealSlot) - slots.indexOf(b.mealSlot))} />)}
  </SectionCard>;
}
