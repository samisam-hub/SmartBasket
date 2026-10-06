import { useMemo, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ErrorMessage, Screen, ScreenHeader, SecondaryButton, SectionCard, SelectionChip } from '@/components/ui';
import { MealSwipeCards } from '@/components/MealSwipeCards';
import { usePreferences } from '@/context/PreferencesContext';
import { useWeekPlan } from '@/context/WeekPlanContext';
import { useAuth } from '@/context/AuthContext';
import { useBasketCatalog } from '@/hooks/useBasketCatalog';
import { getSupabaseClient } from '@/lib/supabase';
import { readyCategories, readyCategoryLabels } from '@/services/meals/choices';
import { recordChoice, type ChoiceAction } from '@/services/meals/choiceEvents';
import { suggestMeals, type MealSuggestion } from '@/services/meals/planner';
import { slotLabels } from '@/services/preference-domain';
import { dayOf, isPlanDate, openSlots, planDateLabel } from '@/services/meals/weekPlan';
import { mealSlots, type MealSlot, type ReadyMealCategory } from '@/types/meal';
import { ui } from '@/lib/theme';

/** Screen 4: choose one meal for one slot. Only one meal per slot: the first yes ends it. */
export default function PlanSlotScreen() {
  const { date, slot, for: forParam } = useLocalSearchParams<{ date: string; slot: string; for?: string }>();
  const { saved } = usePreferences();
  const { session } = useAuth();
  const { plan, ready, error, store } = useWeekPlan();
  const catalog = useBasketCatalog();
  const [shown, setShown] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const rounds = useRef(0);
  const mealSlot = mealSlots.includes(slot as MealSlot) ? (slot as MealSlot) : null;
  // "for" names the people this dish is for; without it the whole household eats it.
  const eating = forParam?.split(',').filter(Boolean);
  const eatingNames = eating?.map(id => plan?.participants?.find(person => person.id === id)?.name || 'Person');
  const valid = ready && saved && plan && mealSlot && isPlanDate(date) && dayOf(plan, date);
  const suggestions = useMemo(() => valid ? suggestMeals(plan!, date, mealSlot!, saved!, catalog.products, shown, eating) : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [valid, plan, date, mealSlot, saved, catalog.products, shown, forParam]);
  if (!ready || catalog.loading) return <Screen><Text style={ui.body}>Looking for meals…</Text></Screen>;
  if (!valid) return <Screen bottom>
    <ScreenHeader title="That meal is not planned" subtitle="Pick the day and the meal on the calendar first." />
    <SecondaryButton label="Back to the calendar" onPress={() => router.replace('/')} />
  </Screen>;
  const record = (action: ChoiceAction, chosenMealId?: string) => {
    void recordChoice(getSupabaseClient(), session?.user.id ?? null, { planDate: date, mealSlot: mealSlot!,
      shownMealIds: suggestions.map(suggestion => suggestion.meal.id), action, chosenMealId, round: rounds.current });
  };
  const next = () => {
    const left = openSlots(plan!, date).filter(other => other !== mealSlot);
    if (left.length) router.replace({ pathname: '/plan/[date]/[slot]', params: { date, slot: left[0] } });
    else router.replace({ pathname: '/plan/day-done', params: { date } });
  };
  const act = (action: ChoiceAction, run: () => void, chosenMealId?: string) => {
    try { run(); record(action, chosenMealId); setMessage(null); next(); }
    catch (e) { setMessage(e instanceof Error ? e.message : 'That did not work.'); }
  };
  const categories = readyCategories('heat_and_eat', mealSlot!);
  const takeAway = (mode: 'heat_and_eat' | 'ready_to_eat', category?: ReadyMealCategory) =>
    act(mode, () => store.chooseMode(date, mealSlot!, mode, category, saved!, eating));
  return <Screen bottom>
    <ScreenHeader eyebrow={planDateLabel(date).toUpperCase()} title={slotLabels[mealSlot!]}
      subtitle={eatingNames?.length
        ? `For ${eatingNames.join(', ')} only. Whoever eats this leaves the household meal of this slot. Swipe right to take a meal, left for the next one.`
        : 'Swipe right to take a meal, left for the next one. The two buttons do exactly the same.'} />
    <ErrorMessage message={message ?? error ?? catalog.error} />
    <MealSwipeCards suggestions={suggestions} exhausted={!suggestions.length}
      onTake={(suggestion: MealSuggestion) =>
        act('chosen', () => store.choose(date, mealSlot!, suggestion, saved!, eating), suggestion.meal.id)}
      onNext={() => setShown(ids => [...ids, suggestions[0].meal.id])}
      onMore={() => { record('shuffled'); rounds.current += 1; setShown(ids => [...ids, ...suggestions.map(s => s.meal.id)]); }} />
    <SectionCard title="Or settle it another way">
      {!eatingNames?.length && <SecondaryButton label="Skip this meal" onPress={() => act('skipped', () => store.skip(date, mealSlot!, saved!))} />}
      <Text style={ui.small}>Skipping means you are not eating this meal at home. It is an answer, not a gap, so the basket will not flag it.</Text>
      <SecondaryButton label={eatingNames?.length ? `${eatingNames.join(', ')} eats out` : "I'm eating out"}
        onPress={() => act('eat_out', () => store.chooseMode(date, mealSlot!, 'eat_out', undefined, saved!, eating))} />
      {categories.length > 0 && <>
        <Text style={ui.subheading}>Heat something up instead</Text>
        <View style={ui.wrap}>
          {categories.map(category => <SelectionChip key={category} label={readyCategoryLabels[category]}
            selected={false} onPress={() => takeAway('heat_and_eat', category)} />)}
        </View>
        <Text style={ui.small}>We look for a matching ready meal with usable preparation, dietary and price data. If none is verified, the basket says so instead of guessing.</Text>
      </>}
      <SecondaryButton label="Back to the day" onPress={() => router.replace({ pathname: '/plan/[date]', params: { date } })} />
    </SectionCard>
  </Screen>;
}
