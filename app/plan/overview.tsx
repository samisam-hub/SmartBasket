import { t } from '@/services/i18n';
import { Text } from 'react-native';
import { router } from 'expo-router';
import { useWeekPlan } from '@/context/WeekPlanContext';
import { ErrorMessage, PrimaryButton, Screen, ScreenHeader, SecondaryButton, SectionCard } from '@/components/ui';
import { PlannedWeek } from '@/components/PlannedWeek';
import { openPlanSlots } from '@/services/meals/validation';
import { cookTwicePairs, meatFreeDays, plannedLeftovers } from '@/services/meals/sustainability';
import { planDateLabel } from '@/services/meals/weekPlan';
import { ui } from '@/lib/theme';

export default function WeekOverviewScreen() {
  const { plan, ready, error } = useWeekPlan();
  if (!ready) return <Screen><Text>{t('overview.loading')}</Text></Screen>;
  if (!plan?.days.length) return <Screen><Text>{t('overview.noWeek')}</Text>
    <SecondaryButton label={t('overview.planWeek')} onPress={() => router.replace('/plan/week')} /></Screen>;
  const open = openPlanSlots(plan).reduce((sum, day) => sum + day.slots.length, 0);
  // What the packs leave behind, said plainly: it is the number a household can actually lower.
  const leftovers = plannedLeftovers(plan.items);
  const amount = (grams: number) => grams >= 1000 ? `${(grams / 1000).toFixed(1)} kg` : `${grams} g`;
  const twice = cookTwicePairs(plan);
  return <Screen bottom>
    <ScreenHeader eyebrow={t('overview.eyebrow')} title={t('overview.title')} subtitle={t('overview.subtitle')} />
    <ErrorMessage message={error} />
    {open > 0 && <SectionCard title={t('overview.openMeals', { count: open })}>
      <Text style={ui.small}>{t('overview.exhaustedNote')}</Text>
    </SectionCard>}
    {!!plan.items.length && <SectionCard title={t('overview.care')}>
      <Text style={ui.body}>{t('overview.leftovers', { amount: amount(leftovers.fresh) })}</Text>
      <Text style={ui.small}>{t('overview.leftoversKeep', { amount: amount(leftovers.total - leftovers.fresh) })}</Text>
      <Text style={ui.small}>{t('overview.meatFree', { count: meatFreeDays(plan), days: plan.days.length })}</Text>
      {twice.map(pair => <Text key={pair.dates[0]} style={ui.small}>
        {t('overview.cookTwice', { name: pair.name, first: planDateLabel(pair.dates[0]),
          second: planDateLabel(pair.dates[1]) })}
      </Text>)}
    </SectionCard>}
    <PlannedWeek plan={plan}
      onOpenDay={date => router.push({ pathname: '/plan/[date]', params: { date, returnTo: 'week' } })} />
    <PrimaryButton label={t('overview.toList')} disabled={!plan.items.length || open > 0}
      onPress={() => router.push({ pathname: '/basket-setup', params: { week: '1' } })} />
    <SecondaryButton label={t('overview.changeTastes')} onPress={() => router.push('/plan/taste')} />
    <SecondaryButton label={t('overview.changeDays')} onPress={() => router.push('/plan/week')} />
  </Screen>;
}
