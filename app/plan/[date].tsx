import { Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ErrorMessage, PrimaryButton, Screen, ScreenHeader, SecondaryButton, SectionCard, SelectionChip, TextButton } from '@/components/ui';
import { usePreferences } from '@/context/PreferencesContext';
import { useWeekPlan } from '@/context/WeekPlanContext';
import { MealImage } from '@/components/MealImage';
import { slotLabels } from '@/services/preference-domain';
import { dayOf, isPlanDate, itemsOn, planDateLabel, sortSlots } from '@/services/meals/weekPlan';
import { participantKind } from '@/services/profile-domain';
import { mealSlots, type MealSlot } from '@/types/meal';
import { ui } from '@/lib/theme';

/** Screen 3: one day. Every chosen meal is either decided or waiting, and single meals can go. */
export default function PlanDayScreen() {
  const { date } = useLocalSearchParams<{ date: string }>();
  const { saved } = usePreferences();
  const { plan, ready, error, store } = useWeekPlan();
  if (!ready) return <Screen><Text style={ui.body}>Loading your week…</Text></Screen>;
  const day = plan && isPlanDate(date) ? dayOf(plan, date) : null;
  if (!saved || !plan || !day) return <Screen bottom>
    <ScreenHeader title="That day is not planned" subtitle="Pick the day on the calendar first." />
    <PrimaryButton label="Back to the calendar" onPress={() => router.replace('/plan/week')} />
  </Screen>;
  const items = itemsOn(plan, date);
  const people = plan.participants ?? [];
  const decided = (slot: MealSlot) => items.find(item => item.mealSlot === slot);
  const openSlots = sortSlots(day.slots).filter(slot => !decided(slot));
  return <Screen bottom>
    <ScreenHeader title={planDateLabel(date)} subtitle={openSlots.length
      ? `${openSlots.length} ${openSlots.length === 1 ? 'meal' : 'meals'} left to choose.`
      : 'Every meal of this day is decided.'} />
    <ErrorMessage message={error} />
    {sortSlots(day.slots).map(slot => {
      const item = decided(slot);
      return <SectionCard key={slot} title={slotLabels[slot]}>
        {item ? <>
          <Text style={ui.subheading}>{item.meal.name}</Text>
          <MealImage meal={item.meal} compact />
          {people.length > 1 && <>
            <Text style={ui.caption}>Who is eating this?</Text>
            <View style={ui.wrap}>
              {people.map(person => {
                const present = item.participantIds ?? people.map(other => other.id);
                const eating = present.includes(person.id);
                return <SelectionChip key={person.id} selected={eating}
                  label={`${person.name || 'Person'}${participantKind(person) === 'child' ? ' (child)' : ''}`}
                  onPress={() => store.setPresence(date, slot,
                    eating ? present.filter(id => id !== person.id) : [...present, person.id], saved)} />;
              })}
            </View>
            <Text style={ui.small}>Nothing is bought for whoever is not eating at home.</Text>
          </>}
          <View style={[ui.row, { gap: 8 }]}>
            <TextButton label="Choose another" onPress={() => { store.clear(date, slot, saved);
              router.push({ pathname: '/plan/[date]/[slot]', params: { date, slot } }); }} />
            <TextButton label="Not at home" onPress={() => store.skip(date, slot, saved)} />
          </View>
        </> : <>
          <Text style={ui.small}>Not chosen yet.</Text>
          <PrimaryButton label={`Choose ${slotLabels[slot].toLowerCase()}`}
            onPress={() => router.push({ pathname: '/plan/[date]/[slot]', params: { date, slot } })} />
        </>}
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
