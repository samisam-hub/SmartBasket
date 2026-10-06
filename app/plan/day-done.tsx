import { Text } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { PrimaryButton, Screen, ScreenHeader, SecondaryButton, SectionCard } from '@/components/ui';
import { useWeekPlan } from '@/context/WeekPlanContext';
import { openPlanSlots } from '@/services/meals/validation';
import { itemsOn, planDateLabel, plannedDates } from '@/services/meals/weekPlan';
import { slotLabels } from '@/services/preference-domain';
import { ui } from '@/lib/theme';

/** Screen 5: a day is done. The way on is always the calendar, never a dead end. */
export default function DayDoneScreen() {
  const { date } = useLocalSearchParams<{ date: string }>();
  const { plan } = useWeekPlan();
  const meals = plan ? itemsOn(plan, date) : [];
  const openDays = plan ? openPlanSlots(plan).filter(day => day.date !== date) : [];
  const nextDay = plan ? plannedDates(plan).find(other => openDays.some(day => day.date === other)) : undefined;
  return <Screen bottom>
    <ScreenHeader title={`${planDateLabel(date)} is planned`}
      subtitle={meals.length ? `${meals.length} ${meals.length === 1 ? 'meal' : 'meals'} for this day.` : 'Nothing is cooked at home on this day.'} />
    <SectionCard>
      {meals.map(item => <Text key={item.id} style={ui.small}>{slotLabels[item.mealSlot]}: {item.meal.name}</Text>)}
      {!meals.length && <Text style={ui.small}>You are eating elsewhere on this day.</Text>}
    </SectionCard>
    {nextDay
      ? <PrimaryButton label={`Plan ${planDateLabel(nextDay)}`} onPress={() => router.replace({ pathname: '/plan/[date]', params: { date: nextDay } })} />
      : <PrimaryButton label="Back to the week" onPress={() => router.replace('/')} />}
    <SecondaryButton label="Back to the week" onPress={() => router.replace('/')} />
  </Screen>;
}
