import { slotLabel } from '@/services/i18n';
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
  if (!ready) return <Screen><Text>Vorlieben werden geladen…</Text></Screen>;
  if (!saved) return <Screen>
    <ErrorMessage message={error} />
    <ScreenHeader title="Zuerst den Haushalt anlegen" subtitle="Wer mitisst, bestimmt die Portionen und welche Gerichte passen." />
    <SecondaryButton label="Haushalt anlegen" onPress={() => router.replace('/household-setup')} />
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
    } catch (e) { setMessage(e instanceof Error ? e.message : 'Vorliebe konnte nicht gespeichert werden.'); }
  };
  const generate = async () => {
    if (pending.current) return;
    pending.current = true; setBusy(true); setMessage(null);
    try {
      await store.saveDraft();
      store.generate(saved, catalog.products);
      await store.flush();
      router.replace('/plan/overview');
    } catch (e) { setMessage(e instanceof Error ? e.message : 'Der Plan konnte nicht erstellt werden.'); }
    finally { pending.current = false; setBusy(false); }
  };
  return <Screen bottom>
    <ScreenHeader eyebrow="1 · VORLIEBEN" title={slot ? `${slotLabel(slot)}: Was mögt ihr?` : 'Was mögt ihr gerne?'}
      subtitle={`Rechts: mögen. Links: nicht mögen. Das merkt eure Vorlieben und legt noch keine Mahlzeit auf einen Tag. ${planned ? 'Danach entsteht euer Wochenplan.' : 'Danach wählt ihr die Tage, für die geplant wird.'}`} />
    <ErrorMessage message={message ?? error ?? catalog.error} />
    <Text style={ui.small}>Vorlieben bleiben für diesen Haushalt auf diesem Gerät gespeichert. Allergien und Ernährungsregeln gelten immer. Gerichte ohne Bewertung bleiben möglich; abgelehnte Gerichte werden nicht automatisch eingeplant.</Text>
    {!slot ? slots.map(candidate => {
      const dishes = tasteMeals(candidate, saved);
      const rated = dishes.filter(meal => mealRatings[meal.id] !== undefined).length;
      const liked = dishes.filter(meal => mealRatings[meal.id] === true).length;
      return <SectionCard key={candidate} title={slotLabel(candidate)}>
        <Text style={ui.small}>{rated} von {dishes.length} bewertet · {liked} gemerkt</Text>
        {dishes.length ? <SecondaryButton label={rated === dishes.length ? `${slotLabel(candidate)} erneut bewerten` : `${slotLabel(candidate)} wischen`}
          disabled={busy} onPress={() => open(candidate, rated === dishes.length)} />
          : <Text style={ui.small}>Keine passenden Gerichte für eure Ernährungsregeln. Diese Mahlzeiten bleiben im Plan offen.</Text>}
      </SectionCard>;
    }) : <>
      <Text style={ui.small}>{Math.min(position + 1, queue.length)} von {queue.length}</Text>
      {current ? <MealSwipeCards mode="taste" busy={busy}
        suggestions={queue.slice(position, position + 2).map(meal => ({ meal, servings: 1 }))} exhausted={false}
        onTake={() => rate(true)} onNext={() => rate(false)} onMore={() => {}} />
        : <SectionCard title="Bewertung abgeschlossen">
          <Text style={ui.small}>{queue.filter(meal => mealRatings[meal.id] === true).length} Gerichte gemerkt.</Text>
          <SecondaryButton label="Erneut bewerten" disabled={busy} onPress={() => open(slot, true)} />
        </SectionCard>}
      {!!history.length && <TextButton label="Letzte Bewertung zurücknehmen" disabled={busy} onPress={() => {
        const last = history[history.length - 1];
        try { store.rateMeal(last.id, last.previous); setPosition(last.position); setHistory(history.slice(0, -1)); }
        catch (e) { setMessage(e instanceof Error ? e.message : 'Bewertung konnte nicht geändert werden.'); }
      }} />}
      <SecondaryButton label="Zur Mahlzeitenübersicht" disabled={busy} onPress={() => setSlot(null)} />
    </>}
    <Text style={ui.small}>Ihr könnt jederzeit planen und später weiterwischen. Bestehende Entscheidungen bleiben erhalten; offene Mahlzeiten werden ergänzt.</Text>
    {planned
      ? <PrimaryButton label={busy ? 'Wochenplan wird erstellt…' : 'Wochenplan erstellen'} disabled={busy || catalog.loading}
          onPress={() => { void generate(); }} />
      : <PrimaryButton label="Weiter: Tage auswählen" disabled={busy} onPress={() => router.replace('/plan/week')} />}
    {planned && <SecondaryButton label="Tage und Anwesenheit ändern" disabled={busy} onPress={() => router.push('/plan/week')} />}
  </Screen>;
}
