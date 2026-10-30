import { slotLabel, t } from '@/services/i18n';
import { useRef, useState } from 'react';
import { router } from 'expo-router';
import { Text } from 'react-native';
import { usePreferences } from '@/context/PreferencesContext';
import { useWeekPlan } from '@/context/WeekPlanContext';
import { useBasketCatalog } from '@/hooks/useBasketCatalog';
import { MealSwipeCards } from '@/components/MealSwipeCards';
import { ErrorMessage, PrimaryButton, Screen, ScreenHeader, SecondaryButton, SectionCard, TextButton } from '@/components/ui';
import { tasteMeals } from '@/services/meals/taste';
import { mealSlots, type MealSlot } from '@/types/meal';
import { activeSlots } from '@/types/preferences';
import { ui } from '@/lib/theme';

export default function MealTasteScreen() {
  const { saved } = usePreferences();
  const { plan, ready, error, mealRatings, store } = useWeekPlan();
  const catalog = useBasketCatalog();
  const [slot, setSlot] = useState<MealSlot | null>(null);
  const [position, setPosition] = useState(0);
  const [history, setHistory] = useState<{ position: number; id: string; previous: boolean | null }[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const pending = useRef(false);
  if (!ready) return <Screen><Text>{t('taste.loading')}</Text></Screen>;
  if (!saved) return <Screen>
    <ErrorMessage message={error} />
    <ScreenHeader title={t('taste.needsHousehold')} subtitle={t('taste.needsHouseholdHint')} />
    <SecondaryButton label={t('taste.toHousehold')} onPress={() => router.replace('/household-setup')} />
  </Screen>;
  // Vor der ersten Woche gelten die Mahlzeiten des Haushalts; danach die der geplanten Tage.
  const planned = !!plan?.days.length;
  const slots = planned
    ? mealSlots.filter(candidate => plan!.days.some(day => day.slots.includes(candidate)))
    : activeSlots(saved);
  const queue = slot ? tasteMeals(slot, saved) : [];
  const current = queue[position];
  const open = (chosen: MealSlot, restart = false) => {
    const candidates = tasteMeals(chosen, saved);
    const next = candidates.findIndex(meal => mealRatings[meal.id] === undefined);
    setSlot(chosen); setPosition(restart ? 0 : next === -1 ? candidates.length : next); setHistory([]);
  };
  const rate = (rating: boolean) => {
    if (!current || pending.current) return;
    try {
      store.rateMeal(current.id, rating);
      setHistory(previous => [...previous, { position, id: current.id, previous: mealRatings[current.id] ?? null }]);
      setPosition(position + 1); setMessage(null);
    } catch (e) { setMessage(e instanceof Error ? e.message : t('taste.rateFailed')); }
  };
  const generate = async () => {
    if (pending.current) return;
    pending.current = true; setBusy(true); setMessage(null);
    try {
      await store.saveDraft();
      store.generate(saved, catalog.products);
      await store.flush();
      router.replace('/plan/overview');
    } catch (e) { setMessage(e instanceof Error ? e.message : t('taste.planFailed')); }
    finally { pending.current = false; setBusy(false); }
  };
  return <Screen bottom>
    <ScreenHeader eyebrow={t('taste.eyebrow')}
      title={slot ? t('taste.titleSlot', { slot: slotLabel(slot) }) : t('taste.title')}
      subtitle={t('taste.subtitle', { next: t(planned ? 'taste.nextPlan' : 'taste.nextDays') })} />
    <ErrorMessage message={message ?? error ?? catalog.error} />
    <Text style={ui.small}>{t('taste.note')}</Text>
    {!slot ? slots.map(candidate => {
      const dishes = tasteMeals(candidate, saved);
      const rated = dishes.filter(meal => mealRatings[meal.id] !== undefined).length;
      const liked = dishes.filter(meal => mealRatings[meal.id] === true).length;
      return <SectionCard key={candidate} title={slotLabel(candidate)}>
        <Text style={ui.small}>{t('taste.rated', { rated, total: dishes.length, liked })}</Text>
        {dishes.length ? <SecondaryButton label={t(rated === dishes.length ? 'taste.rateAgainSlot' : 'taste.swipeSlot', { slot: slotLabel(candidate) })}
          disabled={busy} onPress={() => open(candidate, rated === dishes.length)} />
          : <Text style={ui.small}>{t('taste.noMeals')}</Text>}
      </SectionCard>;
    }) : <>
      <Text style={ui.small}>{t('taste.position', { position: Math.min(position + 1, queue.length), total: queue.length })}</Text>
      {current ? <MealSwipeCards mode="taste" busy={busy}
        suggestions={queue.slice(position, position + 2).map(meal => ({ meal, servings: 1 }))} exhausted={false}
        onTake={() => rate(true)} onNext={() => rate(false)} onMore={() => {}} />
        : <SectionCard title={t('taste.doneTitle')}>
          <Text style={ui.small}>{t('taste.keptCount', { count: queue.filter(meal => mealRatings[meal.id] === true).length })}</Text>
          <SecondaryButton label={t('taste.rateAgain')} disabled={busy} onPress={() => open(slot, true)} />
        </SectionCard>}
      {!!history.length && <TextButton label={t('taste.undo')} disabled={busy} onPress={() => {
        const last = history[history.length - 1];
        try { store.rateMeal(last.id, last.previous); setPosition(last.position); setHistory(history.slice(0, -1)); }
        catch (e) { setMessage(e instanceof Error ? e.message : t('taste.undoFailed')); }
      }} />}
      <SecondaryButton label={t('taste.backToSlots')} disabled={busy} onPress={() => setSlot(null)} />
    </>}
    <Text style={ui.small}>{t('taste.anytime')}</Text>
    {planned
      ? <PrimaryButton label={t(busy ? 'taste.creating' : 'taste.create')} disabled={busy || catalog.loading}
          onPress={() => { void generate(); }} />
      : <PrimaryButton label={t('taste.toDays')} disabled={busy} onPress={() => router.replace('/plan/week')} />}
    {planned && <SecondaryButton label={t('taste.changeDays')} disabled={busy} onPress={() => router.push('/plan/week')} />}
  </Screen>;
}
