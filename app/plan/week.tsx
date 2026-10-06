import { Text, View } from 'react-native';
import { router } from 'expo-router';
import { PrimaryButton, Screen, ScreenHeader, SectionCard, SelectionChip, ErrorMessage, SecondaryButton } from '@/components/ui';
import { usePreferences } from '@/context/PreferencesContext';
import { useWeekPlan } from '@/context/WeekPlanContext';
import { currentWeekStart } from '@/components/WeekCalendar';
import { activeSlotLabels } from '@/services/preference-domain';
import { addDays, dayOf, planDateLabel, plannedDates, weekDates } from '@/services/meals/weekPlan';
import { ui } from '@/lib/theme';

/** Screen 2: pick the days of this week, gaps included. Nothing has to be consecutive. */
export default function PlanWeekScreen() {
  const { saved } = usePreferences();
  const { plan, ready, error, store } = useWeekPlan();
  const weekStart = plan?.weekStart ?? currentWeekStart();
  if (!saved) return <Screen><Text style={ui.body}>Set your preferences first, then pick your days.</Text>
    <SecondaryButton label="Set preferences" onPress={() => router.push('/onboarding/welcome')} /></Screen>;
  if (!ready) return <Screen><Text style={ui.body}>Loading your week…</Text></Screen>;
  const planned = plan ? plannedDates(plan) : [];
  const open = (date: string) => {
    if (!plan || !dayOf(plan, date)) store.open(weekStart, saved);
    store.toggleDay(date, saved);
  };
  return <Screen bottom>
    <ScreenHeader title="Which days are you cooking?" subtitle={`${planDateLabel(weekStart)} – ${planDateLabel(addDays(weekStart, 6))}. Pick as many or as few as you like; days in between can stay empty.`} />
    <ErrorMessage message={error} />
    <SectionCard>
      <View style={ui.wrap}>
        {weekDates(weekStart).map(date => <SelectionChip key={date} label={planDateLabel(date)}
          selected={!!plan && !!dayOf(plan, date)} onPress={() => open(date)} />)}
      </View>
      <Text style={ui.small}>Each day you pick starts with {activeSlotLabels(saved).join(', ').toLowerCase()}. You can drop single meals on the day itself.</Text>
    </SectionCard>
    {planned.length > 0 && <SectionCard title="Your week">
      {planned.map(date => <Text key={date} style={ui.small}>{planDateLabel(date)}: {dayOf(plan!, date)!.slots.join(', ')}</Text>)}
    </SectionCard>}
    <PrimaryButton label={planned.length ? 'Plan the first day' : 'Pick at least one day'} disabled={!planned.length}
      onPress={() => router.replace({ pathname: '/plan/[date]', params: { date: planned[0] } })} />
  </Screen>;
}
