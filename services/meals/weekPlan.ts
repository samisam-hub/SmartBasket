import type {
  AnyMealPlan,
  AnyMealPlanItem,
  MealChoice,
  MealSlot,
  WeekPlan,
  WeekPlanDay,
} from '../../types/meal';
import { mealSlots } from '../../types/meal';
import { activeSlots, type UserPreferences } from '../../types/preferences';
import { slotCalorieShare } from './config';

/** Plan dates are plain calendar days, so every conversion stays in UTC and never shifts
 *  a day across a time zone or a daylight-saving change. */
const pattern = /^(\d{4})-(\d{2})-(\d{2})$/;
export const DAYS_PER_WEEK = 7;
export function parsePlanDate(date: string): Date | null {
  const match = pattern.exec(date);
  if (!match) return null;
  const [, year, month, day] = match;
  const parsed = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  // Rejects impossible days such as 2026-02-30, which Date would silently roll over.
  return planDate(parsed) === date ? parsed : null;
}
export const planDate = (date: Date): string => date.toISOString().slice(0, 10);
export const isPlanDate = (date: unknown): date is string =>
  typeof date === 'string' && parsePlanDate(date) !== null;
export function addDays(date: string, days: number): string {
  const parsed = parsePlanDate(date);
  if (!parsed) throw Error('Invalid plan date');
  return planDate(new Date(parsed.getTime() + days * 86400000));
}
/** The Monday on or before the given day; weeks in the calendar always start on Monday. */
export function weekStartOf(date: string): string {
  const parsed = parsePlanDate(date);
  if (!parsed) throw Error('Invalid plan date');
  return addDays(date, -((parsed.getUTCDay() + 6) % 7));
}
export const isWeekStart = (date: unknown): date is string =>
  isPlanDate(date) && weekStartOf(date) === date;
export const weekDates = (weekStart: string): string[] =>
  Array.from({ length: DAYS_PER_WEEK }, (_, offset) => addDays(weekStart, offset));
export const inWeek = (weekStart: string, date: string): boolean =>
  isPlanDate(date) && date >= weekStart && date < addDays(weekStart, DAYS_PER_WEEK);

/** A fresh week nobody has filled in yet: the days are chosen on the calendar screen. */
export function emptyWeekPlan(weekStart: string, preferences: UserPreferences): WeekPlan {
  if (!isWeekStart(weekStart)) throw Error('A week starts on a Monday.');
  return {
    version: '2', weekStart, days: [], status: 'review', items: [], warnings: [],
    householdSize: preferences.householdSize, targetCalories: 0, targetProtein: 0,
    ...(preferences.participants ? { participants: structuredClone(preferences.participants) } : {}),
  };
}
/** The slots a newly chosen day starts with, in slot order, from the household's meal standard. */
export const defaultDaySlots = (preferences: { slotDefaults?: UserPreferences['slotDefaults'] }): MealSlot[] =>
  activeSlots(preferences);
export const sortSlots = (slots: MealSlot[]): MealSlot[] =>
  mealSlots.filter(slot => slots.includes(slot));
export const plannedDates = (plan: WeekPlan): string[] =>
  plan.days.map(day => day.date).sort();
export const dayOf = (plan: WeekPlan, date: string): WeekPlanDay | null =>
  plan.days.find(day => day.date === date) ?? null;
export const itemsOn = (plan: WeekPlan, date: string): WeekPlan['items'] =>
  plan.items.filter(item => item.date === date);
/** An open slot is one the household chose to eat at home and has not decided yet. */
export const openSlots = (plan: WeekPlan, date: string): MealSlot[] => {
  const day = dayOf(plan, date);
  if (!day) return [];
  const planned = new Set(itemsOn(plan, date).map(item => item.mealSlot));
  return sortSlots(day.slots).filter(slot => !planned.has(slot));
};

export const isWeekPlanShape = (plan: AnyMealPlan): plan is WeekPlan => plan.version === '2';
/** The calendar date an item is planned for. Version 1 plans have no dates, only day numbers. */
export const itemDate = (plan: AnyMealPlan, item: AnyMealPlanItem): string | null =>
  isWeekPlanShape(plan) && 'date' in item ? item.date : null;
/** Position of an item's day within the plan, for display order and per-day grouping. */
export function itemDayIndex(plan: AnyMealPlan, item: AnyMealPlanItem): number {
  if (!isWeekPlanShape(plan)) return 'dayIndex' in item ? item.dayIndex : 0;
  return 'date' in item ? plannedDates(plan).indexOf(item.date) : -1;
}
/** Days a plan actually covers: the chosen dates of a week, or the fixed period of a version 1 plan. */
export const plannedDayCount = (plan: AnyMealPlan): number =>
  isWeekPlanShape(plan) ? plan.days.length : plan.planningDays;
/** Items of either plan shape, where only the choice itself matters. */
export const planChoices = (plan: AnyMealPlan): MealChoice[] => plan.items;
// Plan dates are stored as calendar days, so the label is formatted in UTC as well.
const dayFormat = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
export const planDateLabel = (date: string): string => dayFormat.format(parsePlanDate(date) ?? new Date(NaN));
export interface PlanDay { key: string; label: string; date: string | null; items: AnyMealPlanItem[] }
/** Every day a plan covers, in order, including days with nothing planned on them. */
export function planDays(plan: AnyMealPlan): PlanDay[] {
  if (isWeekPlanShape(plan)) return plannedDates(plan).map(date =>
    ({ key: date, label: planDateLabel(date), date, items: itemsOn(plan, date) }));
  return Array.from({ length: plan.planningDays }, (_, index) =>
    ({ key: `day-${index}`, label: `Day ${index + 1}`, date: null,
      items: plan.items.filter(item => item.dayIndex === index) }));
}
export const itemDayLabel = (plan: AnyMealPlan, item: AnyMealPlanItem): string =>
  isWeekPlanShape(plan) && 'date' in item ? planDateLabel(item.date)
    : `Day ${('dayIndex' in item ? item.dayIndex : 0) + 1}`;
/** How much of a person's day a week actually covers: the shares of the slots the household
 *  chose to eat at home. A day nobody planned, and a slot they dropped, are not counted as a gap. */
export const plannedSlotShare = (plan: WeekPlan): number =>
  plan.days.reduce((sum, day) => sum + day.slots.reduce((share, slot) => share + slotCalorieShare[slot], 0), 0);
/** Who a planned meal is for. An item without a list is for the whole household. */
export const itemGroup = (plan: AnyMealPlan, item: AnyMealPlanItem): string[] =>
  item.participantIds ?? plan.participants?.map(person => person.id) ?? [];
export const itemsInSlot = (plan: WeekPlan, date: string, slot: MealSlot): WeekPlan['items'] =>
  itemsOn(plan, date).filter(item => item.mealSlot === slot);
/** True when the two meals would feed the same person, which no slot may do. */
export const groupsOverlap = (a: string[], b: string[]): boolean =>
  !a.length || !b.length || a.some(id => b.includes(id));
/** The people a slot already feeds, across all meals planned in it. */
export const coveredInSlot = (plan: WeekPlan, date: string, slot: MealSlot): string[] =>
  [...new Set(itemsInSlot(plan, date, slot).flatMap(item => itemGroup(plan, item)))];
