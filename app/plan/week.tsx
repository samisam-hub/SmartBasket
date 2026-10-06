import { useState } from 'react';
import { Text, View } from 'react-native';
import { router } from 'expo-router';
import { PrimaryButton, Screen, ScreenHeader, SectionCard, SelectionChip, ErrorMessage, SecondaryButton } from '@/components/ui';
import { usePreferences } from '@/context/PreferencesContext';
import { useWeekPlan } from '@/context/WeekPlanContext';
import { currentWeekStart } from '@/components/WeekCalendar';
import { activeSlotLabels, slotLabels } from '@/services/preference-domain';
import { addDays, dayOf, planDateLabel, plannedDates, weekDates } from '@/services/meals/weekPlan';
import { mealSlots, type MealSlot } from '@/types/meal';
import { ui } from '@/lib/theme';

/** Screen 2: pick the days of this week, gaps included. Nothing has to be consecutive. */
export default function PlanWeekScreen() {
  const [copyError, setCopyError] = useState<string | null>(null);
  const [personId, setPersonId] = useState<string | null>(null);
  const [routineSlot, setRoutineSlot] = useState<MealSlot>('lunch');
  const { saved } = usePreferences();
  const { plan, ready, error, attendanceRules, store } = useWeekPlan();
  const weekStart = plan?.weekStart ?? currentWeekStart();
  if (!saved) return <Screen><Text style={ui.body}>Set your preferences first, then pick your days.</Text>
    <SecondaryButton label="Set preferences" onPress={() => router.push('/onboarding/welcome')} /></Screen>;
  if (!ready) return <Screen><Text style={ui.body}>Loading your week…</Text></Screen>;
  const planned = plan ? plannedDates(plan) : [];
  const selectedPerson = saved.participants?.some(person => person.id === personId)
    ? personId : saved.participants?.[0]?.id;
  const open = (date: string) => {
    try {
      if (!plan) store.open(weekStart, saved);
      store.toggleDay(date, saved);
      setCopyError(null);
    } catch (e) { setCopyError(e instanceof Error ? e.message : 'Could not change this day.'); }
  };
  return <Screen bottom>
    <ScreenHeader title="Which days are you cooking?" subtitle={`${planDateLabel(weekStart)} – ${planDateLabel(addDays(weekStart, 6))}. Pick as many or as few as you like; days in between can stay empty.`} />
    <ErrorMessage message={copyError ?? error} />
    {store.canCopyPreviousWeek(weekStart, saved) && <SectionCard>
      <SecondaryButton label="Copy last week's plan" onPress={() => {
        try { store.copyPreviousWeek(weekStart, saved); setCopyError(null); }
        catch (e) { setCopyError(e instanceof Error ? e.message : 'Could not copy last week.'); }
      }} />
      <Text style={ui.small}>Days, meals and attendance become an editable draft for this week.</Text>
    </SectionCard>}
    <SectionCard>
      <View style={ui.wrap}>
        {weekDates(weekStart).map(date => <SelectionChip key={date} label={planDateLabel(date)}
          selected={!!plan && !!dayOf(plan, date)} onPress={() => open(date)} />)}
      </View>
      <Text style={ui.small}>Each day you pick starts with {activeSlotLabels(saved).join(', ').toLowerCase()}. You can drop single meals on the day itself.</Text>
    </SectionCard>
    {!!saved.participants?.length && <SectionCard title="Usually away for a meal">
      <Text style={ui.small}>Set regular school or work meals away from home. New days and meal choices use this as a starting point; you can still change one day.</Text>
      <Text style={ui.subheading}>Who?</Text>
      <View style={ui.wrap}>{saved.participants.map(person => <SelectionChip key={person.id}
        label={person.name || 'Person'} selected={selectedPerson === person.id}
        onPress={() => setPersonId(person.id)} />)}</View>
      <Text style={ui.subheading}>Which meal?</Text>
      <View style={ui.wrap}>{mealSlots.map(slot => <SelectionChip key={slot} label={slotLabels[slot]}
        selected={routineSlot === slot} onPress={() => setRoutineSlot(slot)} />)}</View>
      <Text style={ui.subheading}>On which days?</Text>
      <View style={ui.wrap}>{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((label, weekday) =>
        <SelectionChip key={label} label={label}
          selected={attendanceRules.some(rule => rule.personId === selectedPerson && rule.slot === routineSlot && rule.weekday === weekday)}
          onPress={() => { try { store.toggleAttendanceRule({ personId: selectedPerson!, slot: routineSlot, weekday }, saved);
            setCopyError(null); } catch (e) { setCopyError(e instanceof Error ? e.message : 'Could not save the routine.'); } }} />)}</View>
      <Text style={ui.small}>Selected days mean this person is usually away for this meal. Existing meals stay as you chose them.</Text>
    </SectionCard>}
    {planned.length > 0 && <SectionCard title="Your week">
      {planned.map(date => <Text key={date} style={ui.small}>{planDateLabel(date)}: {dayOf(plan!, date)!.slots.join(', ')}</Text>)}
    </SectionCard>}
    <PrimaryButton label={planned.length ? 'Plan the first day' : 'Pick at least one day'} disabled={!planned.length}
      onPress={() => router.replace({ pathname: '/plan/[date]', params: { date: planned[0] } })} />
  </Screen>;
}
