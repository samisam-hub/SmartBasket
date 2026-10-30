import { slotLabel, term } from '../services/i18n';
import Feather from '@expo/vector-icons/Feather';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import type { AnyMealPlanItem, WeekPlan } from '../types/meal';
import { openPlanSlots } from '../services/meals/validation';
import { addDays, dayOf, itemsInSlot, itemsOn, planDate, planDateLabel, sortSlots, weekDates, weekStartOf } from '../services/meals/weekPlan';
import { MealImage } from './MealImage';
import { IconButton, PrimaryButton, SecondaryButton, TextButton } from './ui';
import { colors, radii, spacing, typography, ui } from '../lib/theme';

export const todayPlanDate = (now: Date = new Date()) => planDate(now);
export const currentWeekStart = (now: Date = new Date()) => weekStartOf(todayPlanDate(now));
const weekdayNames = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
/** What one day of the calendar shows: nothing planned, meals still open, or all decided. */
export function dayState(plan: WeekPlan | null, date: string): 'unplanned' | 'open' | 'done' {
  if (!plan || !dayOf(plan, date)) return 'unplanned';
  return openPlanSlots(plan).some(day => day.date === date) ? 'open' : 'done';
}
export function weekSummary(plan: WeekPlan | null): string {
  if (!plan || !plan.days.length) return 'Noch kein Tag geplant. Wähle die Tage, für die du kochen willst.';
  const open = openPlanSlots(plan).reduce((count, day) => count + day.slots.length, 0);
  const meals = plan.items.length;
  const days = `${plan.days.length} ${plan.days.length === 1 ? 'Tag' : 'Tage'}`;
  if (open) return `${days} geplant · ${meals} ${meals === 1 ? 'Gericht' : 'Gerichte'} gewählt · ${open} noch offen`;
  return `${days} geplant · ${meals} ${meals === 1 ? 'Gericht' : 'Gerichte'} gewählt · bereit für die Einkaufsliste`;
}
/** The day a week opens on: today when it is in this week, otherwise the first day with something
 *  planned, and failing that the Monday it starts on. */
export function openingDate(plan: WeekPlan | null, weekStart: string, today = todayPlanDate()): string {
  const dates = weekDates(weekStart);
  if (dates.includes(today)) return today;
  return dates.find(date => dayState(plan, date) !== 'unplanned') ?? dates[0];
}
/** What a card says beside the name. The curated meals carry no cooking time, so this says what
 *  is actually recorded: which meal of the day it is, and what one portion holds. */
export function mealFacts(item: AnyMealPlanItem): string {
  const parts = [slotLabel(item.mealSlot)];
  if (item.meal.caloriesPerServing) parts.push(`${Math.round(item.meal.caloriesPerServing)} kcal pro Portion`);
  const servings = Math.round(item.servings * 10) / 10;
  parts.push(`${servings} ${servings === 1 ? 'Portion' : 'Portionen'}`);
  return parts.join(' · ');
}

/** Screen 6: the week as the first thing the household sees. The strip picks a day, the cards show
 *  what that day holds, and each card carries the two answers a planned meal can still get. */
export function WeekCalendar({ plan, weekStart, selected, onSelect, onWeek, onBasket, onCopyPrevious, busy }: {
  plan: WeekPlan | null;
  weekStart: string;
  selected: string;
  onSelect: (date: string) => void;
  onWeek: (weekStart: string) => void;
  onBasket: () => void;
  onCopyPrevious?: () => void;
  busy?: boolean;
}) {
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const today = todayPlanDate();
  const dates = weekDates(weekStart);
  const date = dates.includes(selected) ? selected : dates[0];
  const day = plan ? dayOf(plan, date) : null;
  const items = plan ? itemsOn(plan, date) : [];
  const people = plan?.participants ?? [];
  const emptySlots = day ? sortSlots(day.slots).filter(slot => !itemsInSlot(plan!, date, slot).length) : [];
  return <View style={ui.stack}>
    <View style={ui.row}>
      <Text accessibilityRole="header" style={[ui.title, { flex: 1 }]}>Deine Woche</Text>
      <IconButton icon="sliders" label="Tage dieser Woche wählen" disabled={busy}
        onPress={() => router.push('/plan/week')} />
    </View>
    <View style={[ui.row, { gap: spacing.xs, alignItems: 'stretch' }]}>
      <Pressable accessibilityRole="button" accessibilityLabel="Vorherige Woche" disabled={busy}
        onPress={() => onWeek(addDays(weekStart, -7))} style={styles.arrow}>
        <Feather name="chevron-left" size={18} color={colors.primary} />
      </Pressable>
      {dates.map((weekday, index) => {
        const state = dayState(plan, weekday);
        const chosen = weekday === date;
        const count = plan ? itemsOn(plan, weekday).length : 0;
        return <Pressable key={weekday} accessibilityRole="button" disabled={busy}
          accessibilityState={{ selected: chosen }}
          accessibilityLabel={`${planDateLabel(weekday)}: ${state === 'unplanned' ? 'nichts geplant'
            : `${count} ${count === 1 ? 'Gericht' : 'Gerichte'}, ${state === 'open' ? 'noch offen' : 'alles entschieden'}`}`}
          onPress={() => { setOpenMenu(null); onSelect(weekday); }}
          style={({ pressed }) => [styles.pill, chosen && styles.pillOn,
            !chosen && weekday === today && styles.pillToday, pressed && { opacity: 0.7 }]}>
          <Text style={[styles.pillText, chosen && styles.pillTextOn]}>{weekdayNames[index]}</Text>
          {/* The dot keeps the state of a day readable while the strip stays plain. */}
          <View style={[styles.dot, state === 'open' && styles.dotOpen, state === 'done' && styles.dotDone,
            chosen && state !== 'unplanned' && styles.dotOn]} />
        </Pressable>;
      })}
      <Pressable accessibilityRole="button" accessibilityLabel="Nächste Woche" disabled={busy}
        onPress={() => onWeek(addDays(weekStart, 7))} style={styles.arrow}>
        <Feather name="chevron-right" size={18} color={colors.primary} />
      </Pressable>
    </View>
    <Text style={ui.small}>{planDateLabel(date)}</Text>
    {!day && <View style={styles.empty}>
      <Text style={ui.body}>Für diesen Tag ist nichts geplant. Ein ausgelassener Tag ist keine Lücke: die Liste zählt nur
        die Mahlzeiten, die ihr zu Hause essen wollt.</Text>
      <PrimaryButton label="Diesen Tag planen" disabled={busy} onPress={() => router.push('/plan/week')} />
    </View>}
    {items.map(item => {
      const menu = openMenu === item.id;
      const eating = item.participantIds?.map(id => people.find(person => person.id === id)?.name || 'Person');
      return <View key={item.id} style={styles.card}>
        <MealImage meal={item.meal} banner />
        <View style={styles.cardBody}>
          <View style={ui.row}>
            <Text style={[styles.cardTitle, { flex: 1 }]}>{item.meal.name}</Text>
            <IconButton icon="more-horizontal" label={`Optionen für ${item.meal.name}`}
              onPress={() => setOpenMenu(menu ? null : item.id)} />
          </View>
          {eating?.length && <Text style={[ui.caption, { color: colors.primary }]}>Für {eating.join(', ')}</Text>}
          <Text style={ui.small}>{mealFacts(item)}</Text>
          {!!item.meal.dietaryTags.filter(tag => tag !== 'none').length && <View style={ui.wrap}>
            {item.meal.dietaryTags.filter(tag => tag !== 'none').map(tag =>
              <Text key={tag} style={styles.tag}>{term(tag)}</Text>)}
          </View>}
          {menu && <View style={ui.stack}>
            <TextButton label="Anderes wählen" onPress={() => router.push({ pathname: '/plan/[date]/[slot]',
              params: { date, slot: item.mealSlot, ...(item.participantIds ? { for: item.participantIds.join(',') } : {}) } })} />
            <TextButton label="Diesen Tag öffnen" onPress={() => router.push({ pathname: '/plan/[date]', params: { date } })} />
          </View>}
        </View>
      </View>;
    })}
    {emptySlots.map(slot => <Pressable key={slot} accessibilityRole="button"
      accessibilityLabel={`${slotLabel(slot)} wählen`} disabled={busy}
      onPress={() => router.push({ pathname: '/plan/[date]/[slot]', params: { date, slot } })}
      style={({ pressed }) => [styles.openSlot, pressed && { opacity: 0.7 }]}>
      <Feather name="plus-circle" size={22} color={colors.primary} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.cardTitle}>{slotLabel(slot)}</Text>
        <Text style={ui.small}>Noch nicht gewählt</Text>
      </View>
      <Feather name="chevron-right" size={22} color={colors.muted} />
    </Pressable>)}
    <Text style={ui.small}>{weekSummary(plan)}</Text>
    <SecondaryButton label={plan?.days.length ? 'Tage ändern' : 'Tage wählen'} disabled={busy}
      onPress={() => router.push('/plan/week')} />
    {onCopyPrevious && <SecondaryButton label="Plan der Vorwoche übernehmen" disabled={busy} onPress={onCopyPrevious} />}
    {plan?.days.length ? <SecondaryButton label={openPlanSlots(plan).length ? 'Vorlieben & Wochenplan' : 'Wochenplan ansehen'}
      disabled={busy} onPress={() => router.push(openPlanSlots(plan).length ? '/plan/taste' : '/plan/overview')} /> : null}
    {!!plan?.items.length && <PrimaryButton label="Einkaufsliste erstellen" disabled={busy} onPress={onBasket} />}
  </View>;
}
const styles = {
  arrow: { justifyContent: 'center' as const, paddingHorizontal: 2 },
  pill: { flex: 1, minWidth: 0, alignItems: 'center' as const, gap: 4, paddingVertical: spacing.sm,
    borderRadius: radii.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  pillOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  pillToday: { borderColor: colors.primary },
  pillText: { ...typography.caption, fontWeight: '700' as const, color: colors.ink },
  pillTextOn: { color: colors.onPrimary },
  dot: { width: 5, height: 5, borderRadius: radii.pill, backgroundColor: 'transparent' as const },
  dotOpen: { backgroundColor: colors.orange },
  dotDone: { backgroundColor: colors.primary },
  dotOn: { backgroundColor: colors.onPrimary },
  card: { backgroundColor: colors.surface, borderRadius: radii.large, borderWidth: 1,
    borderColor: colors.border, overflow: 'hidden' as const },
  cardBody: { padding: spacing.lg, gap: spacing.xs },
  cardTitle: { ...typography.h3, color: colors.ink },
  tag: { ...typography.caption, color: colors.primary, backgroundColor: colors.pale,
    borderRadius: radii.pill, paddingHorizontal: spacing.sm, paddingVertical: 2, overflow: 'hidden' as const },
  empty: { backgroundColor: colors.surface, borderRadius: radii.large, borderWidth: 1,
    borderColor: colors.border, padding: spacing.lg, gap: spacing.md },
  openSlot: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: spacing.md,
    padding: spacing.lg, borderRadius: radii.large, borderWidth: 1, borderStyle: 'dashed' as const,
    borderColor: colors.border, backgroundColor: colors.surface },
};
