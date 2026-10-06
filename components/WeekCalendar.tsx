import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import type { WeekPlan } from '../types/meal';
import { openPlanSlots } from '../services/meals/validation';
import { addDays, dayOf, itemsOn, planDate, planDateLabel, weekDates, weekStartOf } from '../services/meals/weekPlan';
import { PrimaryButton, SectionCard, SecondaryButton } from './ui';
import { colors, spacing, ui } from '../lib/theme';

export const todayPlanDate = (now: Date = new Date()) => planDate(now);
export const currentWeekStart = (now: Date = new Date()) => weekStartOf(todayPlanDate(now));
const weekdayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
/** What one day of the calendar shows: nothing planned, meals still open, or all decided. */
export function dayState(plan: WeekPlan | null, date: string): 'unplanned' | 'open' | 'done' {
  if (!plan || !dayOf(plan, date)) return 'unplanned';
  return openPlanSlots(plan).some(day => day.date === date) ? 'open' : 'done';
}
export function weekSummary(plan: WeekPlan | null): string {
  if (!plan || !plan.days.length) return 'No day planned yet. Pick the days you want to cook for.';
  const open = openPlanSlots(plan).reduce((count, day) => count + day.slots.length, 0);
  const meals = plan.items.length;
  const days = `${plan.days.length} ${plan.days.length === 1 ? 'day' : 'days'}`;
  if (open) return `${days} planned · ${meals} ${meals === 1 ? 'meal' : 'meals'} chosen · ${open} still open`;
  return `${days} planned · ${meals} ${meals === 1 ? 'meal' : 'meals'} chosen · ready for a basket`;
}

/** Screen 6: the week as the first thing the household sees, with every day reachable in one tap. */
export function WeekCalendar({ plan, weekStart, onWeek, onBasket, busy }: {
  plan: WeekPlan | null;
  weekStart: string;
  onWeek: (weekStart: string) => void;
  onBasket: () => void;
  busy?: boolean;
}) {
  const today = todayPlanDate();
  const dates = weekDates(weekStart);
  const ready = !!plan?.items.length;
  return <SectionCard>
    <View style={[ui.row, { justifyContent: 'space-between', alignItems: 'center' }]}>
      <Pressable accessibilityRole="button" accessibilityLabel="Previous week" disabled={busy}
        onPress={() => onWeek(addDays(weekStart, -7))} style={{ padding: spacing.xs }}>
        <Text style={[ui.body, { color: colors.primary }]}>‹</Text>
      </Pressable>
      <Text style={ui.subheading}>{planDateLabel(weekStart)} – {planDateLabel(addDays(weekStart, 6))}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Next week" disabled={busy}
        onPress={() => onWeek(addDays(weekStart, 7))} style={{ padding: spacing.xs }}>
        <Text style={[ui.body, { color: colors.primary }]}>›</Text>
      </Pressable>
    </View>
    <View style={[ui.row, { gap: spacing.xs }]}>
      {dates.map((date, index) => {
        const state = dayState(plan, date);
        const meals = plan ? itemsOn(plan, date).length : 0;
        return <Pressable key={date} accessibilityRole="button" disabled={busy}
          accessibilityLabel={`${planDateLabel(date)}: ${state === 'unplanned' ? 'nothing planned' : `${meals} ${meals === 1 ? 'meal' : 'meals'}, ${state === 'open' ? 'still open' : 'all decided'}`}`}
          onPress={() => router.push(state === 'unplanned' ? '/plan/week' : { pathname: '/plan/[date]', params: { date } })}
          style={({ pressed }) => ({ flex: 1, minWidth: 0, alignItems: 'center', gap: 4, paddingVertical: spacing.sm,
            borderRadius: 12, opacity: pressed ? 0.7 : 1, borderWidth: date === today ? 2 : 1,
            borderColor: date === today ? colors.primary : colors.border,
            backgroundColor: state === 'unplanned' ? 'transparent' : state === 'open' ? colors.pale : colors.primary })}>
          <Text style={[ui.caption, { color: state === 'done' ? colors.surface : colors.muted }]}>{weekdayNames[index]}</Text>
          <Text style={[ui.small, { fontWeight: '700', color: state === 'done' ? colors.surface : colors.ink }]}>
            {Number(date.slice(8, 10))}
          </Text>
          <Text style={[ui.caption, { color: state === 'done' ? colors.surface : colors.muted }]}>
            {state === 'unplanned' ? '–' : `${meals}`}
          </Text>
        </Pressable>;
      })}
    </View>
    <Text style={ui.small}>{weekSummary(plan)}</Text>
    <SecondaryButton label={plan?.days.length ? 'Change the days' : 'Pick your days'} disabled={busy}
      onPress={() => router.push('/plan/week')} />
    {ready && <PrimaryButton label="Create my basket" disabled={busy} onPress={onBasket} />}
  </SectionCard>;
}
