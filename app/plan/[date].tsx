import { slotLabel } from '@/services/i18n';
import { contentName } from '@/services/i18n/content';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ErrorMessage, PrimaryButton, Screen, ScreenHeader, SecondaryButton, SectionCard, SelectionChip, TextButton } from '@/components/ui';
import { usePreferences } from '@/context/PreferencesContext';
import { useWeekPlan } from '@/context/WeekPlanContext';
import { MealImage } from '@/components/MealImage';
import { dayOf, isPlanDate, itemGroup, itemsInSlot, planDateLabel, sortSlots } from '@/services/meals/weekPlan';
import { participantKind } from '@/services/profile-domain';
import { mealSlots } from '@/types/meal';
import { ui } from '@/lib/theme';

/** Screen 3: one day. Every chosen meal is either decided or waiting, and single meals can go. */
export default function PlanDayScreen() {
  const { date, returnTo } = useLocalSearchParams<{ date: string; returnTo?: string }>();
  const [message, setMessage] = useState<string | null>(null);
  const { saved } = usePreferences();
  const { plan, ready, error, store } = useWeekPlan();
  if (!ready) return <Screen><Text style={ui.body}>Deine Woche wird geladen …</Text></Screen>;
  const day = plan && isPlanDate(date) ? dayOf(plan, date) : null;
  if (!saved || !plan || !day) return <Screen bottom>
    <ScreenHeader title="Dieser Tag ist nicht eingeplant" subtitle="Wähle zuerst den Tag im Kalender aus." />
    <PrimaryButton label="Zurück zum Kalender" onPress={() => router.replace('/plan/week')} />
  </Screen>;
  const people = plan.participants ?? [];
  const run = (action: () => void) => { try { action(); setMessage(null); } catch (e) { setMessage(e instanceof Error ? e.message : "Das hat nicht geklappt."); } };
  const openSlots = sortSlots(day.slots).filter(slot => !itemsInSlot(plan, date, slot).length);
  return <Screen bottom>
    <ScreenHeader title={planDateLabel(date)} subtitle={openSlots.length
      ? `${openSlots.length} ${openSlots.length === 1 ? 'Mahlzeit' : 'Mahlzeiten'} noch auszuwählen.`
      : "Alle Mahlzeiten dieses Tages sind ausgewählt."} />
    <ErrorMessage message={message ?? error} />
    {sortSlots(day.slots).map(slot => {
      const dishes = itemsInSlot(plan, date, slot);
      const eatingSomethingElse = dishes.flatMap(dish => dish.participantIds ?? []);
      return <SectionCard key={slot} title={slotLabel(slot)}>
        {dishes.map(item => <View key={item.id} style={ui.stack}>
          <Text style={ui.subheading}>{contentName(item.meal.name)}</Text>
          {item.participantIds && <Text style={ui.caption}>

            Für {item.participantIds.map(id => people.find(person => person.id === id)?.name || 'Person').join(', ')}
          </Text>}
          <MealImage meal={item.meal} compact />
          {people.length > 1 && <>
            <Text style={ui.caption}>Wer isst mit?</Text>
            <View style={ui.wrap}>
              {people.map(person => {
                const present = itemGroup(plan, item);
                const eating = present.includes(person.id);
                const atOtherDish = dishes.some(other => other.id !== item.id && itemGroup(plan, other).includes(person.id));
                return <SelectionChip key={person.id} selected={eating} disabled={atOtherDish}
                  label={`${person.name || 'Person'}${participantKind(person) === 'child' ? ' (Kind)' : ''}`}
                  onPress={() => run(() => store.setPresence(item.id,
                    eating ? present.filter(id => id !== person.id) : [...present, person.id], saved))} />;
              })}
            </View>
            <Text style={ui.small}>Wer nicht zu Hause isst, wird beim Einkauf nicht berücksichtigt.</Text>
          </>}
          <View style={[ui.row, { gap: 8 }]}>
            <TextButton label="Anderes Gericht wählen" onPress={() => {
              router.push({ pathname: '/plan/[date]/[slot]', params: { date, slot, returnTo, replaceItem: item.id,
                ...(item.participantIds ? { for: item.participantIds.join(',') } : {}) } }); }} />
            <TextButton label="Nicht zu Hause" onPress={() => run(() => store.setPresence(item.id, [], saved))} />
          </View>
        </View>)}
        {!dishes.length && <>
          <Text style={ui.small}>Noch nicht ausgewählt.</Text>
          <PrimaryButton label={`${slotLabel(slot)} auswählen`}
            onPress={() => router.push({ pathname: '/plan/[date]/[slot]', params: { date, slot, returnTo } })} />
        </>}
        {!!dishes.length && people.length > 1 && people.filter(person => !eatingSomethingElse.includes(person.id)).map(person =>
          <TextButton key={`own-${person.id}`} label={`${person.name || 'Person'} isst etwas anderes`}
            onPress={() => router.push({ pathname: '/plan/[date]/[slot]', params: { date, slot, returnTo, for: person.id } })} />)}
      </SectionCard>;
    })}
    <SectionCard title="Mahlzeiten dieses Tages">
      <View style={ui.wrap}>
        {mealSlots.map(slot => <SelectionChip key={slot} label={slotLabel(slot)} selected={day.slots.includes(slot)}
          onPress={() => { try { store.toggleSlot(date, slot, saved); } catch { store.skip(date, slot, saved); } }} />)}
      </View>
      <Text style={ui.small}>Beim Abwählen einer Mahlzeit wird auch das gewählte Gericht entfernt. Sie zählt dann als auswärts gegessen und nicht als offene Mahlzeit.</Text>
    </SectionCard>
    <PrimaryButton label={openSlots.length ? "Weiter auswählen" : "Tag abschließen"}
      onPress={() => openSlots.length
        ? router.push({ pathname: '/plan/[date]/[slot]', params: { date, slot: openSlots[0], returnTo } })
        : returnTo === 'week' ? router.replace('/plan/overview') : router.replace({ pathname: '/plan/day-done', params: { date } })} />
    <SecondaryButton label={returnTo === 'week' ? 'Zurück zum Wochenplan' : "Zurück zum Kalender"} onPress={() => router.replace(returnTo === 'week' ? '/plan/overview' : '/')} />
  </Screen>;
}
