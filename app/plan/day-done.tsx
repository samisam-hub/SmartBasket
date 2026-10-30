import { slotLabel, t } from '@/services/i18n';
import { contentName } from '@/services/i18n/content';
import { Text } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { PrimaryButton, Screen, ScreenHeader, SecondaryButton, SectionCard } from '@/components/ui';
import { useWeekPlan } from '@/context/WeekPlanContext';
import { openPlanSlots } from '@/services/meals/validation';
import { itemsOn, planDateLabel, plannedDates } from '@/services/meals/weekPlan';
import { ui } from '@/lib/theme';

/** Screen 5: a day is done. The way on is always the calendar, never a dead end. */
export default function DayDoneScreen() {
  const { date } = useLocalSearchParams<{ date: string }>();
  const { plan } = useWeekPlan();
  const meals = plan ? itemsOn(plan, date) : [];
  const openDays = plan ? openPlanSlots(plan).filter(day => day.date !== date) : [];
  const nextDay = plan ? plannedDates(plan).find(other => openDays.some(day => day.date === other)) : undefined;
  return <Screen bottom>
    <ScreenHeader title={`${planDateLabel(date)} ist geplant`}
      subtitle={meals.length ? `${meals.length} ${meals.length === 1 ? 'Mahlzeit' : 'Mahlzeiten'} für diesen Tag.` : t('dayDone.noCooking')} />
    <SectionCard>
      {meals.map(item => <Text key={item.id} style={ui.small}>{slotLabel(item.mealSlot)}: {contentName(item.meal.name)}</Text>)}
      {!meals.length && <Text style={ui.small}>{t('dayDone.eatingOut')}</Text>}
    </SectionCard>
    {nextDay
      ? <PrimaryButton label={`${planDateLabel(nextDay)} planen`} onPress={() => router.replace({ pathname: '/plan/[date]', params: { date: nextDay } })} />
      : <PrimaryButton label={t('dayDone.backToWeek')} onPress={() => router.replace('/')} />}
    <SecondaryButton label={t('dayDone.backToWeek')} onPress={() => router.replace('/')} />
  </Screen>;
}
