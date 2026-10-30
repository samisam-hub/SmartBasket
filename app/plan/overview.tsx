import { slotLabel, t } from '@/services/i18n';
import { contentName } from '@/services/i18n/content';
import { Text } from 'react-native';
import { router } from 'expo-router';
import { useWeekPlan } from '@/context/WeekPlanContext';
import { ErrorMessage, PrimaryButton, Screen, ScreenHeader, SecondaryButton, SectionCard } from '@/components/ui';
import { itemsInSlot, planDateLabel } from '@/services/meals/weekPlan';
import { openPlanSlots } from '@/services/meals/validation';
import { ui } from '@/lib/theme';

export default function WeekOverviewScreen() {
  const { plan, ready, error } = useWeekPlan();
  if (!ready) return <Screen><Text>{t('overview.loading')}</Text></Screen>;
  if (!plan?.days.length) return <Screen><Text>{t('overview.noWeek')}</Text>
    <SecondaryButton label={t('overview.planWeek')} onPress={() => router.replace('/plan/week')} /></Screen>;
  const open = openPlanSlots(plan).reduce((sum, day) => sum + day.slots.length, 0);
  return <Screen bottom>
    <ScreenHeader eyebrow={t('overview.eyebrow')} title={t('overview.title')} subtitle={t('overview.subtitle')} />
    <ErrorMessage message={error} />
    {open > 0 && <SectionCard title={t('overview.openMeals', { count: open })}>
      <Text style={ui.small}>{t('overview.exhaustedNote')}</Text>
    </SectionCard>}
    {plan.days.map(day => <SectionCard key={day.date} title={planDateLabel(day.date)}>
      {day.slots.map(slot => {
        const dishes = itemsInSlot(plan, day.date, slot);
        return <Text key={slot} style={ui.body}>{slotLabel(slot)}: {dishes.length ? dishes.map(item => contentName(item.meal.name)).join(' / ') : 'Noch offen'}</Text>;
      })}
      <SecondaryButton label={t('overview.editDay', { date: planDateLabel(day.date) })} onPress={() => router.push({ pathname: '/plan/[date]', params: { date: day.date, returnTo: 'week' } })} />
    </SectionCard>)}
    <PrimaryButton label={t('overview.toList')} disabled={!plan.items.length || open > 0}
      onPress={() => router.push({ pathname: '/basket-setup', params: { week: '1' } })} />
    <SecondaryButton label={t('overview.changeTastes')} onPress={() => router.push('/plan/taste')} />
    <SecondaryButton label={t('overview.changeDays')} onPress={() => router.push('/plan/week')} />
  </Screen>;
}
