import { readyCategoryLabel, slotLabel, t } from '@/services/i18n';
import { contentName } from '@/services/i18n/content';
import { useMemo, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ErrorMessage, Screen, ScreenHeader, SecondaryButton, SectionCard, SelectionChip } from '@/components/ui';
import { MealSwipeCards } from '@/components/MealSwipeCards';
import { MealImage } from '@/components/MealImage';
import { usePreferences } from '@/context/PreferencesContext';
import { useWeekPlan } from '@/context/WeekPlanContext';
import { useAuth } from '@/context/AuthContext';
import { useBasketCatalog } from '@/hooks/useBasketCatalog';
import { getSupabaseClient } from '@/lib/supabase';
import { clearChoice } from '@/services/meals/weekPlanDraft';
import { readyCategories } from '@/services/meals/choices';
import { recordChoice, type ChoiceAction } from '@/services/meals/choiceEvents';
import { quickIndividualMeals, suggestMeals, type MealSuggestion } from '@/services/meals/planner';
import { dayOf, isPlanDate, itemsInSlot, openSlots, planDateLabel } from '@/services/meals/weekPlan';
import { mealSlots, type MealSlot, type ReadyMealCategory } from '@/types/meal';
import { ui } from '@/lib/theme';

/** Screen 4: choose one meal for one slot. Only one meal per slot: the first yes ends it. */
export default function PlanSlotScreen() {
  const { date, slot, for: forParam, returnTo, replaceItem } = useLocalSearchParams<{ date: string; slot: string; for?: string; returnTo?: string; replaceItem?: string }>();
  const { saved } = usePreferences();
  const { session } = useAuth();
  const { plan, ready, error, mealRatings, store } = useWeekPlan();
  const catalog = useBasketCatalog();
  const [shown, setShown] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const rounds = useRef(0);
  const mealSlot = mealSlots.includes(slot as MealSlot) ? (slot as MealSlot) : null;
  // "for" names the people this dish is for; without it the whole household eats it.
  const eating = forParam?.split(',').filter(Boolean);
  const eatingNames = eating?.map(id => plan?.participants?.find(person => person.id === id)?.name || 'Person');
  const replacing = replaceItem ? plan?.items.find(item => item.id === replaceItem && item.date === date && item.mealSlot === mealSlot) : undefined;
  const candidatePlan = useMemo(() => replacing && plan && saved ? clearChoice(plan, replacing.id, saved) : plan,
    [plan, saved, replacing]);
  const valid = (!replaceItem || !!replacing) && ready && saved && plan && mealSlot && isPlanDate(date) && dayOf(plan, date);
  const suggestions = useMemo(() => valid ? suggestMeals(candidatePlan!, date, mealSlot!, saved!, catalog.products, [...shown, ...(replacing ? [replacing.meal.id] : [])], eating, mealRatings) : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [valid, candidatePlan, date, mealSlot, saved, catalog.products, shown, forParam, mealRatings, replacing]);
  if (!ready || catalog.loading) return <Screen><Text style={ui.body}>Gerichte werden gesucht …</Text></Screen>;
  if (!valid) return <Screen bottom>
    <ScreenHeader title={t('slot.notPlanned')} subtitle={t('slot.pickFirst')} />
    <SecondaryButton label={t('slot.backToCalendar')} onPress={() => router.replace('/')} />
  </Screen>;
  const record = (action: ChoiceAction, chosenMealId?: string) => {
    const shownMealIds = suggestions.map(suggestion => suggestion.meal.id);
    if (chosenMealId && !shownMealIds.includes(chosenMealId)) shownMealIds.push(chosenMealId);
    void recordChoice(getSupabaseClient(), session?.user.id ?? null, { planDate: date, mealSlot: mealSlot!,
      shownMealIds, action, chosenMealId, round: rounds.current });
  };
  const next = () => {
    if (returnTo === 'week') { router.replace('/plan/overview'); return; }
    const left = openSlots(plan!, date).filter(other => other !== mealSlot);
    if (left.length) router.replace({ pathname: '/plan/[date]/[slot]', params: { date, slot: left[0] } });
    else router.replace({ pathname: '/plan/day-done', params: { date } });
  };
  const act = (action: ChoiceAction, run: () => void, chosenMealId?: string) => {
    try { run(); record(action, chosenMealId); setMessage(null); next(); }
    catch (e) { setMessage(e instanceof Error ? e.message : t('slot.failed')); }
  };
  const categories = readyCategories('heat_and_eat', mealSlot!);
  const ownDishAlreadyChosen = !!eating?.length && itemsInSlot(plan!, date, mealSlot!).some(item =>
    item.participantIds?.length === eating.length && item.participantIds.every(id => eating.includes(id)));
  const quickMeals = eatingNames?.length && !ownDishAlreadyChosen
    ? quickIndividualMeals(plan!, mealSlot!, saved!) : [];
  const takeAway = (mode: 'heat_and_eat' | 'ready_to_eat', category?: ReadyMealCategory) =>
    act(mode, () => replacing ? store.replaceMode(replacing.id, mode, category, saved!) : store.chooseMode(date, mealSlot!, mode, category, saved!, eating));
  return <Screen bottom>
    <ScreenHeader eyebrow={planDateLabel(date).toUpperCase()} title={slotLabel(mealSlot!)}
      subtitle={eatingNames?.length
        ? t('slot.aloneHint', { people: eatingNames.join(', ') })
        : t('slot.swipeHint')} />
    <ErrorMessage message={message ?? error ?? catalog.error} />
    <MealSwipeCards suggestions={suggestions} exhausted={!suggestions.length}
      onTake={(suggestion: MealSuggestion) =>
        act('chosen', () => replacing ? store.replaceMeal(replacing.id, suggestion, saved!) : store.choose(date, mealSlot!, suggestion, saved!, eating), suggestion.meal.id)}
      onNext={() => setShown(ids => [...ids, suggestions[0].meal.id])}
      onMore={() => { record('shuffled'); rounds.current += 1; setShown(ids => [...ids, ...suggestions.map(s => s.meal.id)]); }} />
    {quickMeals.length > 0 &&
      <SectionCard title={t('slot.simpleMeal')}>
        <Text style={ui.small}>{t('slot.lunchboxNote')}</Text>
        {quickMeals.map(suggestion => <View key={suggestion.meal.id} style={ui.stack}>
          <MealImage meal={suggestion.meal} compact />
          <SecondaryButton label={contentName(suggestion.meal.name)}
            onPress={() => act('chosen', () => replacing ? store.replaceMeal(replacing.id, suggestion, saved!) : store.choose(date, mealSlot!, suggestion, saved!, eating), suggestion.meal.id)} />
        </View>)}
      </SectionCard>}
    <SectionCard title={t('slot.otherWays')}>
      {!eatingNames?.length && <SecondaryButton label={t('slot.skip')} onPress={() => act('skipped', () => store.skip(date, mealSlot!, saved!))} />}
      <Text style={ui.small}>{t('slot.skipNote')}</Text>
      <SecondaryButton label={eatingNames?.length ? t('slot.eatingOut', { people: eatingNames.join(', ') }) : t('slot.eatOut')}
        onPress={() => act('eat_out', () => replacing ? store.replaceMode(replacing.id, 'eat_out', undefined, saved!) : store.chooseMode(date, mealSlot!, 'eat_out', undefined, saved!, eating))} />
      {categories.length > 0 && <>
        <Text style={ui.subheading}>{t('slot.heatInstead')}</Text>
        <View style={ui.wrap}>
          {categories.map(category => <SelectionChip key={category} label={readyCategoryLabel(category)}
            selected={false} onPress={() => takeAway('heat_and_eat', category)} />)}
        </View>
        <Text style={ui.small}>{t('slot.readyMealNote')}</Text>
      </>}
      <SecondaryButton label={t('slot.backToDay')} onPress={() => router.replace({ pathname: '/plan/[date]', params: { date, returnTo } })} />
    </SectionCard>
  </Screen>;
}
