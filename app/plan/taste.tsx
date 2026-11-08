import { slotLabel, t } from '@/services/i18n';
import { useRef, useState } from 'react';
import { router } from 'expo-router';
import { Text } from 'react-native';
import { usePreferences } from '@/context/PreferencesContext';
import { useWeekPlan } from '@/context/WeekPlanContext';
import { useBasketCatalog } from '@/hooks/useBasketCatalog';
import { MealSwipeCards } from '@/components/MealSwipeCards';
import { ErrorMessage, PrimaryButton, Screen, ScreenHeader, SecondaryButton, SectionCard, TextButton } from '@/components/ui';
import { tastePasses } from '@/services/meals/taste';
import { mealSlots } from '@/types/meal';
import { activeSlots } from '@/types/preferences';
import { ui } from '@/lib/theme';

/** Screen 1: one run through the dishes, meal by meal.
 *
 *  Breakfast first, then lunch and dinner together, then snacks — without going back to a menu in
 *  between, because the question is the same each time. Allergies and the household's way of
 *  eating have already taken dishes out before the first card is shown. */
export default function MealTasteScreen() {
  const { saved } = usePreferences();
  const { plan, ready, error, mealRatings, store } = useWeekPlan();
  const catalog = useBasketCatalog();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [history, setHistory] = useState<{ id: string; previous: boolean | null }[]>([]);
  const [skipped, setSkipped] = useState(false);
  const pending = useRef(false);
  const run = useRef<ReturnType<typeof tastePasses> | null>(null);
  if (!ready) return <Screen><Text>{t('taste.loading')}</Text></Screen>;
  if (!saved) return <Screen>
    <ErrorMessage message={error} />
    <ScreenHeader title={t('taste.needsHousehold')} subtitle={t('taste.needsHouseholdHint')} />
    <SecondaryButton label={t('taste.toHousehold')} onPress={() => router.replace('/household-setup')} />
  </Screen>;
  // Before the first week there is nothing planned yet, so the household's own meals are asked about.
  const planned = !!plan?.days.length;
  const slots = planned
    ? mealSlots.filter(slot => plan!.days.some(day => day.slots.includes(slot)))
    : activeSlots(saved);
  // The dishes of this run are chosen once: rating one must not pull another in behind it, or the
  // run would never end. A later planning round starts again here and gets the next ones.
  run.current ??= tastePasses(saved, slots, mealRatings);
  const asked = run.current;
  const openPasses = asked.map(pass => ({ ...pass, meals: pass.meals.filter(meal => mealRatings[meal.id] === undefined) }))
    .filter(pass => pass.meals.length);
  const total = asked.reduce((count, pass) => count + pass.meals.length, 0);
  const left = openPasses.reduce((count, pass) => count + pass.meals.length, 0);
  const pass = openPasses[0];
  const rate = (rating: boolean) => {
    if (!pass || pending.current) return;
    const current = pass.meals[0];
    try {
      store.rateMeal(current.id, rating);
      setHistory(previous => [...previous, { id: current.id, previous: mealRatings[current.id] ?? null }]);
      setMessage(null);
    } catch (e) { setMessage(e instanceof Error ? e.message : t('taste.rateFailed')); }
  };
  const generate = async () => {
    if (pending.current) return;
    pending.current = true; setBusy(true); setMessage(null);
    try {
      if (catalog.error && !catalog.products.length) { setMessage(catalog.error); return; }
      await store.saveDraft();
      store.generate(saved, catalog.products);
      await store.flush();
      router.replace('/plan/overview');
    } catch (e) { setMessage(e instanceof Error ? e.message : t('taste.planFailed')); }
    finally { pending.current = false; setBusy(false); }
  };
  const liked = Object.values(mealRatings).filter(Boolean).length;
  const done = !pass || skipped;
  return <Screen bottom>
    <ScreenHeader eyebrow={t('taste.eyebrow')}
      title={done ? t('taste.allDone') : t('taste.titleSlot', { slot: slotLabel(pass.key) })}
      subtitle={done ? undefined : t('taste.subtitle', { next: t(planned ? 'taste.nextPlan' : 'taste.nextDays') })} />
    <ErrorMessage message={message ?? error} />
    {done
      ? <SectionCard>
          <Text style={ui.body}>{t('taste.allDoneBody', { liked })}</Text>
          {!!left && <SecondaryButton label={t('taste.rateAgain')} disabled={busy} onPress={() => setSkipped(false)} />}
        </SectionCard>
      : <>
          <Text style={ui.small}>{t('taste.progress', { done: total - left + 1, total })}</Text>
          {/* Somebody who has rated before may not want to rate again for every new week. */}
          {liked > 0 && <TextButton label={t('taste.useLast', { count: liked })} disabled={busy}
            onPress={() => setSkipped(true)} />}
          <MealSwipeCards mode="taste" busy={busy} exhausted={false} eyebrow={slotLabel(pass.key)}
            suggestions={pass.meals.slice(0, 2).map(meal => ({ meal, servings: 1 }))}
            onTake={() => rate(true)} onNext={() => rate(false)} onMore={() => {}} />
          {!!history.length && <TextButton label={t('taste.undo')} disabled={busy} onPress={() => {
            const last = history[history.length - 1];
            try { store.rateMeal(last.id, last.previous); setHistory(history.slice(0, -1)); }
            catch (e) { setMessage(e instanceof Error ? e.message : t('taste.undoFailed')); }
          }} />}
          <TextButton label={t('taste.skipRest')} disabled={busy} onPress={() => setSkipped(true)} />
        </>}
    <Text style={ui.small}>{t('taste.note')}</Text>
    {planned
      ? <PrimaryButton label={t(busy ? 'taste.creating' : 'taste.create')} disabled={busy || catalog.loading}
          onPress={() => { void generate(); }} />
      : <PrimaryButton label={t('taste.toDays')} disabled={busy} onPress={() => router.replace('/plan/week')} />}
    {planned && <SecondaryButton label={t('taste.changeDays')} disabled={busy} onPress={() => router.push('/plan/week')} />}
  </Screen>;
}
