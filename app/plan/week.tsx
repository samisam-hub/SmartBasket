import { slotLabel, t } from '@/services/i18n';
import { weekdayShort , addDays, dayOf, planDateLabel, plannedDates, weekDates } from '@/services/meals/weekPlan';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { router } from 'expo-router';
import { PrimaryButton, Screen, ScreenHeader, SectionCard, SelectionChip, ErrorMessage, SecondaryButton } from '@/components/ui';
import { usePreferences } from '@/context/PreferencesContext';
import { useWeekPlan } from '@/context/WeekPlanContext';
import { currentWeekStart } from '@/components/WeekCalendar';
import { activeSlotLabels } from '@/services/preference-domain';
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
  if (!saved) return <Screen><Text style={ui.body}>{t('week.needsPreferences')}</Text>
    <SecondaryButton label={t('week.setPreferences')} onPress={() => router.push('/onboarding/welcome')} /></Screen>;
  if (!ready) return <Screen><Text style={ui.body}>{t('week.loading')}</Text></Screen>;
  const planned = plan ? plannedDates(plan) : [];
  const selectedPerson = saved.participants?.some(person => person.id === personId)
    ? personId : saved.participants?.[0]?.id;
  const open = (date: string) => {
    try {
      if (!plan) store.open(weekStart, saved);
      store.toggleDay(date, saved);
      setCopyError(null);
    } catch (e) { setCopyError(e instanceof Error ? e.message : t('week.dayFailed')); }
  };
  return <Screen bottom>
    <ScreenHeader title={t('week.title')} subtitle={t('week.subtitle', { from: planDateLabel(weekStart), to: planDateLabel(addDays(weekStart, 6)) })} />
    <ErrorMessage message={copyError ?? error} />
    {store.canCopyPreviousWeek(weekStart, saved) && <SectionCard>
      <SecondaryButton label={t('week.copyPrevious')} onPress={() => {
        try { store.copyPreviousWeek(weekStart, saved); setCopyError(null); }
        catch (e) { setCopyError(e instanceof Error ? e.message : t('week.copyFailed')); }
      }} />
      <Text style={ui.small}>{t('week.copyNote')}</Text>
    </SectionCard>}
    <SectionCard>
      <View style={ui.wrap}>
        {weekDates(weekStart).map(date => <SelectionChip key={date} label={planDateLabel(date)}
          selected={!!plan && !!dayOf(plan, date)} onPress={() => open(date)} />)}
      </View>
      <Text style={ui.small}>{t('week.slotsNote', { slots: activeSlotLabels(saved).join(', ').toLowerCase() })}</Text>
    </SectionCard>
    {!!saved.participants?.length && <SectionCard title={t('week.routine')}>
      <Text style={ui.small}>{t('week.routineNote')}</Text>
      <Text style={ui.subheading}>{t('week.who')}</Text>
      <View style={ui.wrap}>{saved.participants.map(person => <SelectionChip key={person.id}
        label={person.name || t('household.person')} selected={selectedPerson === person.id}
        onPress={() => setPersonId(person.id)} />)}</View>
      <Text style={ui.subheading}>{t('week.whichMeal')}</Text>
      <View style={ui.wrap}>{mealSlots.map(slot => <SelectionChip key={slot} label={slotLabel(slot)}
        selected={routineSlot === slot} onPress={() => setRoutineSlot(slot)} />)}</View>
      <Text style={ui.subheading}>{t('week.whichDays')}</Text>
      <View style={ui.wrap}>{weekdayShort().map((label, weekday) =>
        <SelectionChip key={label} label={label}
          selected={attendanceRules.some(rule => rule.personId === selectedPerson && rule.slot === routineSlot && rule.weekday === weekday)}
          onPress={() => { try { store.toggleAttendanceRule({ personId: selectedPerson!, slot: routineSlot, weekday }, saved);
            setCopyError(null); } catch (e) { setCopyError(e instanceof Error ? e.message : t('week.routineFailed')); } }} />)}</View>
      <Text style={ui.small}>{t('week.routineExplain')}</Text>
    </SectionCard>}
    {planned.length > 0 && <SectionCard title={t('week.yourWeek')}>
      {planned.map(date => <Text key={date} style={ui.small}>{planDateLabel(date)}: {dayOf(plan!, date)!.slots.join(', ')}</Text>)}
    </SectionCard>}
    {!!planned.length && <PrimaryButton label={t('week.createList')}
      onPress={() => router.push({ pathname: '/basket-setup', params: { week: '1' } })} />}
    <SecondaryButton label={t(planned.length ? 'week.toTaste' : 'week.pickOne')} disabled={!planned.length}
      onPress={() => router.push('/plan/taste')} />
  </Screen>;
}
