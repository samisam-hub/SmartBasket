import { useState } from 'react';
import { Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ErrorMessage, PrimaryButton, Screen, ScreenHeader, SecondaryButton, SectionCard, SelectionChip, TextButton } from '@/components/ui';
import { usePreferences } from '@/context/PreferencesContext';
import { useWeekPlan } from '@/context/WeekPlanContext';
import { MealImage } from '@/components/MealImage';
import { slotLabels } from '@/services/preference-domain';
import { dayOf, isPlanDate, itemGroup, itemsInSlot, planDateLabel, sortSlots } from '@/services/meals/weekPlan';
import { participantKind } from '@/services/profile-domain';
import { mealSlots } from '@/types/meal';
import { ui } from '@/lib/theme';

/** Screen 3: one day. Every chosen meal is either decided or waiting, and single meals can go. */
export default function PlanDayScreen() {
  const { date } = useLocalSearchParams<{ date: string }>();
  const [message, setMessage] = useState<string | null>(null);
  const { saved } = usePreferences();
  const { plan, ready, error, store } = useWeekPlan();
  if (!ready) return <Screen><Text style={ui.body}>Loading your week…</Text></Screen>;
  const day = plan && isPlanDate(date) ? dayOf(plan, date) : null;
  if (!saved || !plan || !day) return <Screen bottom>
    <ScreenHeader title="That day is not planned" subtitle="Pick the day on the calendar first." />
    <PrimaryButton label="Back to the calendar" onPress={() => router.replace('/plan/week')} />
  </Screen>;
  const people = plan.participants ?? [];
  const run = (action: () => void) => { try { action(); setMessage(null); } catch (e) { setMessage(e instanceof Error ? e.message : 'That did not work.'); } };
  const openSlots = sortSlots(day.slots).filter(slot => !itemsInSlot(plan, date, slot).length);
  return <Screen bottom>
    <ScreenHeader title={planDateLabel(date)} subtitle={openSlots.length
      ? `${openSlots.length} ${openSlots.length === 1 ? 'meal' : 'meals'} left to choose.`
      : 'Every meal of this day is decided.'} />
    <ErrorMessage message={message ?? error} />
    {sortSlots(day.slots).map(slot => {
      const dishes = itemsInSlot(plan, date, slot);
      const eatingSomethingElse = dishes.flatMap(dish => dish.participantIds ?? []);
      return <SectionCard key={slot} title={slotLabels[slot]}>
        {dishes.map(item => <View key={item.id} style={ui.stack}>
          <Text style={ui.subheading}>{item.meal.name}</Text>
          {item.participantIds && <Text style={ui.caption}>
            For {item.participantIds.map(id => people.find(person => person.id === id)?.name || 'Person').join(', ')}
          </Text>}
          <MealImage meal={item.meal} compact />
          {people.length > 1 && !item.participantIds && <>
            <Text style={ui.caption}>Who is eating this?</Text>
            <View style={ui.wrap}>
              {people.map(person => {
                const present = itemGroup(plan, item);
                const eating = present.includes(person.id);
                return <SelectionChip key={person.id} selected={eating}
                  label={`${person.name || 'Person'}${participantKind(person) === 'child' ? ' (child)' : ''}`}
                  onPress={() => run(() => store.setPresence(item.id,
                    eating ? present.filter(id => id !== person.id) : [...present, person.id], saved))} />;
              })}
            </View>
            <Text style={ui.small}>Nothing is bought for whoever is not eating at home.</Text>
          </>}
          <View style={[ui.row, { gap: 8 }]}>
            <TextButton label="Choose another" onPress={() => { store.clear(item.id, saved);
              router.push({ pathname: '/plan/[date]/[slot]', params: { date, slot,
                ...(item.participantIds ? { for: item.participantIds.join(',') } : {}) } }); }} />
            <TextButton label="Not at home" onPress={() => run(() => store.skip(date, slot, saved))} />
          </View>
        </View>)}
        {!dishes.length && <>
          <Text style={ui.small}>Not chosen yet.</Text>
          <PrimaryButton label={`Choose ${slotLabels[slot].toLowerCase()}`}
            onPress={() => router.push({ pathname: '/plan/[date]/[slot]', params: { date, slot } })} />
        </>}
        {!!dishes.length && people.length > 1 && people.filter(person => !eatingSomethingElse.includes(person.id)).map(person =>
          <TextButton key={`own-${person.id}`} label={`${person.name || 'Person'} eats something else`}
            onPress={() => router.push({ pathname: '/plan/[date]/[slot]', params: { date, slot, for: person.id } })} />)}
      </SectionCard>;
    })}
    <SectionCard title="Meals of this day">
      <View style={ui.wrap}>
        {mealSlots.map(slot => <SelectionChip key={slot} label={slotLabels[slot]} selected={day.slots.includes(slot)}
          onPress={() => { try { store.toggleSlot(date, slot, saved); } catch { store.skip(date, slot, saved); } }} />)}
      </View>
      <Text style={ui.small}>Dropping a meal also drops what was chosen for it. It then counts as eaten elsewhere, not as a gap.</Text>
    </SectionCard>
    <PrimaryButton label={openSlots.length ? 'Keep choosing' : 'This day is done'}
      onPress={() => openSlots.length
        ? router.push({ pathname: '/plan/[date]/[slot]', params: { date, slot: openSlots[0] } })
        : router.replace({ pathname: '/plan/day-done', params: { date } })} />
    <SecondaryButton label="Back to the calendar" onPress={() => router.replace('/')} />
  </Screen>;
}
