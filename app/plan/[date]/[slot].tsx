import { useMemo, useState } from 'react';
import { Text } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ErrorMessage, Screen, ScreenHeader, SecondaryButton, SectionCard } from '@/components/ui';
import { MealSwipeCards } from '@/components/MealSwipeCards';
import { usePreferences } from '@/context/PreferencesContext';
import { useWeekPlan } from '@/context/WeekPlanContext';
import { useBasketCatalog } from '@/hooks/useBasketCatalog';
import { suggestMeals, type MealSuggestion } from '@/services/meals/planner';
import { slotLabels } from '@/services/preference-domain';
import { dayOf, isPlanDate, openSlots, planDateLabel } from '@/services/meals/weekPlan';
import { mealSlots, type MealSlot } from '@/types/meal';
import { ui } from '@/lib/theme';

/** Screen 4: choose one meal for one slot. Only one meal per slot: the first yes ends it. */
export default function PlanSlotScreen() {
  const { date, slot } = useLocalSearchParams<{ date: string; slot: string }>();
  const { saved } = usePreferences();
  const { plan, ready, error, store } = useWeekPlan();
  const catalog = useBasketCatalog();
  const [shown, setShown] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const mealSlot = mealSlots.includes(slot as MealSlot) ? (slot as MealSlot) : null;
  const valid = ready && saved && plan && mealSlot && isPlanDate(date) && dayOf(plan, date);
  const suggestions = useMemo(() => valid ? suggestMeals(plan!, date, mealSlot!, saved!, catalog.products, shown) : [],
    [valid, plan, date, mealSlot, saved, catalog.products, shown]);
  if (!ready || catalog.loading) return <Screen><Text style={ui.body}>Looking for meals…</Text></Screen>;
  if (!valid) return <Screen bottom>
    <ScreenHeader title="That meal is not planned" subtitle="Pick the day and the meal on the calendar first." />
    <SecondaryButton label="Back to the calendar" onPress={() => router.replace('/')} />
  </Screen>;
  const next = () => {
    const left = openSlots(plan!, date).filter(other => other !== mealSlot);
    if (left.length) router.replace({ pathname: '/plan/[date]/[slot]', params: { date, slot: left[0] } });
    else router.replace({ pathname: '/plan/day-done', params: { date } });
  };
  const act = (action: () => void) => {
    try { action(); setMessage(null); next(); }
    catch (e) { setMessage(e instanceof Error ? e.message : 'That did not work.'); }
  };
  return <Screen bottom>
    <ScreenHeader eyebrow={planDateLabel(date).toUpperCase()} title={slotLabels[mealSlot!]}
      subtitle="Swipe right to take a meal, left for the next one. Tapping works just as well." />
    <ErrorMessage message={message ?? error ?? catalog.error} />
    <MealSwipeCards suggestions={suggestions} exhausted={!suggestions.length}
      onTake={(suggestion: MealSuggestion) => act(() => store.choose(date, mealSlot!, suggestion, saved!))}
      onNext={() => setShown(ids => [...ids, suggestions[0].meal.id])}
      onMore={() => setShown(ids => [...ids, ...suggestions.map(s => s.meal.id)])} />
    <SectionCard title="Or settle it another way">
      <SecondaryButton label="Skip this meal" onPress={() => act(() => store.skip(date, mealSlot!, saved!))} />
      <Text style={ui.small}>Skipping means you are not eating this meal at home. It is an answer, not a gap, so the basket will not flag it.</Text>
      <SecondaryButton label="Back to the day" onPress={() => router.replace({ pathname: '/plan/[date]', params: { date } })} />
    </SectionCard>
  </Screen>;
}
