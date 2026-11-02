import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import type { WeekPlan } from '../types/meal';
import { openPlanSlots } from '../services/meals/validation';
import { addDays, dayOf, itemsOn, planDate, planDateLabel, weekDates, weekStartOf } from '../services/meals/weekPlan';
import { PrimaryButton, SectionCard, SecondaryButton } from './ui';
import { colors, spacing, ui } from '../lib/theme';

export const todayPlanDate = (now: Date = new Date()) => planDate(now);
export const currentWeekStart = (now: Date = new Date()) => weekStartOf(todayPlanDate(now));
const weekdayNames = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
/** What one day of the calendar shows: nothing planned, meals still open, or all decided. */
export function dayState(plan: WeekPlan | null, date: string): 'unplanned' | 'open' | 'done' {
  if (!plan || !dayOf(plan, date)) return 'unplanned';
  return openPlanSlots(plan).some(day => day.date === date) ? 'open' : 'done';
}
export function weekSummary(plan: WeekPlan | null): string {
  if (!plan || !plan.days.length) return "Noch keine Mahlzeiten geplant. Plane für die Tage, an denen du Essen brauchst.";
  const open = openPlanSlots(plan).reduce((count, day) => count + day.slots.length, 0);
  const meals = plan.items.length;
  const days = `${plan.days.length} ${plan.days.length === 1 ? 'Tag' : 'Tage'}`;
  if (open) return `${days} geplant · ${meals} ${meals === 1 ? 'Mahlzeit' : 'Mahlzeiten'} ausgewählt · ${open} noch offen`;
  return `${days} geplant · ${meals} ${meals === 1 ? 'Mahlzeit' : 'Mahlzeiten'} ausgewählt · bereit für den Warenkorb`;
}

/** Screen 6: the week as the first thing the household sees, with every day reachable in one tap. */
export function WeekCalendar({ plan, weekStart, onWeek, onBasket, onCopyPrevious, busy }: {
  plan: WeekPlan | null;
  weekStart: string;
  onWeek: (weekStart: string) => void;
  onBasket: () => void;
  onCopyPrevious?: () => void;
  busy?: boolean;
}) {
  const today = todayPlanDate();
  const dates = weekDates(weekStart);
  const ready = !!plan?.items.length;
  return <SectionCard>
    <Text style={ui.subheading}>{weekStart === currentWeekStart() ? "Deine aktuelle Woche" : "Deine ausgewählte Woche"}</Text>
    <Text style={ui.body}>{weekStart === currentWeekStart() ? "Möchtest du für diese Woche einkaufen?" : "Möchtest du für die Mahlzeiten dieser Woche einkaufen?"}</Text>
    <View style={[ui.row, { justifyContent: 'space-between', alignItems: 'center' }]}>
      <Pressable accessibilityRole="button" accessibilityLabel="Vorherige Woche" disabled={busy}
        onPress={() => onWeek(addDays(weekStart, -7))} style={{ padding: spacing.xs }}>
        <Text style={[ui.body, { color: colors.primary }]}>‹</Text>
      </Pressable>
      <Text style={ui.subheading}>{planDateLabel(weekStart)} – {planDateLabel(addDays(weekStart, 6))}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Nächste Woche" disabled={busy}
        onPress={() => onWeek(addDays(weekStart, 7))} style={{ padding: spacing.xs }}>
        <Text style={[ui.body, { color: colors.primary }]}>›</Text>
      </Pressable>
    </View>
    <View style={[ui.row, { gap: spacing.xs }]}>
      {dates.map((date, index) => {
        const state = dayState(plan, date);
        const meals = plan ? itemsOn(plan, date).length : 0;
        return <Pressable key={date} accessibilityRole="button" disabled={busy}
          accessibilityLabel={`${planDateLabel(date)}: ${state === 'unplanned' ? "nichts geplant" : `${meals} ${meals === 1 ? 'Mahlzeit' : 'Mahlzeiten'}, ${state === 'open' ? "noch offen" : "alles ausgewählt"}`}`}
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
    <PrimaryButton label="Mahlzeiten planen" disabled={busy}
      onPress={() => router.push(!plan?.days.length ? '/plan/week' : openPlanSlots(plan).length ? '/plan/taste' : '/plan/overview')} />
    {onCopyPrevious && <SecondaryButton label="Plan der Vorwoche übernehmen" disabled={busy} onPress={onCopyPrevious} />}
    {!!plan?.days.length && <SecondaryButton label="Tage ändern" disabled={busy} onPress={() => router.push('/plan/week')} />}
    {plan?.days.length ? <SecondaryButton label={openPlanSlots(plan).length ? 'Vorlieben & Wochenplan' : 'Wochenplan ansehen'} disabled={busy}
      onPress={() => router.push(openPlanSlots(plan).length ? '/plan/taste' : '/plan/overview')} /> : null}
    {ready && <PrimaryButton label="Warenkorb erstellen" disabled={busy} onPress={onBasket} />}
  </SectionCard>;
}
