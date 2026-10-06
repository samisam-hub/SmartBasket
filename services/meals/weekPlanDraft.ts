import type { MealMode, MealSlot, ReadyMealCategory, WeekPlan, WeekPlanItem } from '../../types/meal';
import { activeSlots, type UserPreferences } from '../../types/preferences';
import { nutritionTargets } from '../basket/nutritionTargets';
import { choicePlaceholder } from './choices';
import type { MealSuggestion } from './planner';
import { isWeekPlan } from './validation';
import { dayOf, emptyWeekPlan, inWeek, isWeekStart, itemsOn, plannedSlotShare, sortSlots, weekDates } from './weekPlan';

/** One meal per date and slot, so the slot itself names the item. */
const itemId = (date: string, slot: MealSlot) => `${date}-${slot}`;
/** Targets follow the meals the household chose to eat at home, the same share the basket measures
 *  coverage against. Recomputed after every change so a plan never carries a stale target. */
export function withTargets(plan: WeekPlan, preferences: UserPreferences): WeekPlan {
  const targets = nutritionTargets({ ...preferences, planningDays: Math.max(0.08, plannedSlotShare(plan)) });
  return { ...plan, targetCalories: targets.calorieTarget, targetProtein: targets.proteinTarget };
}
export function startWeek(weekStart: string, preferences: UserPreferences): WeekPlan {
  return withTargets(emptyWeekPlan(weekStart, preferences), preferences);
}
/** Moving to another week starts that week empty; the current one is not carried over. */
export const moveWeek = (plan: WeekPlan, weekStart: string, preferences: UserPreferences): WeekPlan =>
  plan.weekStart === weekStart ? plan : startWeek(weekStart, preferences);
/** Picking a day prefills it from the meal standard; unpicking it drops what was planned there. */
export function toggleDay(plan: WeekPlan, date: string, preferences: UserPreferences): WeekPlan {
  if (!isWeekStart(plan.weekStart) || !inWeek(plan.weekStart, date)) throw Error('That day is not in this week.');
  const planned = dayOf(plan, date);
  const next: WeekPlan = planned
    ? { ...plan, days: plan.days.filter(day => day.date !== date), items: plan.items.filter(item => item.date !== date) }
    : { ...plan, days: [...plan.days, { date, slots: activeSlots(preferences) }] };
  return withTargets(sortDays(next), preferences);
}
/** Dropping a slot also drops the meal chosen for it: the household is not eating that one at home. */
export function toggleSlot(plan: WeekPlan, date: string, slot: MealSlot, preferences: UserPreferences): WeekPlan {
  const day = dayOf(plan, date);
  if (!day) throw Error('Pick that day first.');
  const chosen = day.slots.includes(slot);
  if (chosen && day.slots.length === 1) throw Error('A planned day needs at least one meal. Unpick the day instead.');
  const slots = chosen ? day.slots.filter(other => other !== slot) : sortSlots([...day.slots, slot]);
  return withTargets({ ...plan,
    days: plan.days.map(other => other.date === date ? { ...other, slots } : other),
    items: chosen ? plan.items.filter(item => item.date !== date || item.mealSlot !== slot) : plan.items,
  }, preferences);
}
/** The first yes wins: a slot that is already decided keeps its meal. */
export function chooseMeal(plan: WeekPlan, date: string, slot: MealSlot, suggestion: MealSuggestion,
  preferences: UserPreferences): WeekPlan {
  const day = dayOf(plan, date);
  if (!day || !day.slots.includes(slot)) throw Error('That meal is not planned for this day.');
  if (itemsOn(plan, date).some(item => item.mealSlot === slot)) return plan;
  const item: WeekPlanItem = { id: itemId(date, slot), date, mealSlot: slot,
    meal: suggestion.meal, servings: suggestion.servings };
  return withTargets({ ...plan, status: 'review', items: [...plan.items, item] }, preferences);
}
/** The honest ways out of a slot: heating something up, buying it ready, or eating out. None of
 *  them carries recorded nutrition, and none of them is a cooked meal in disguise. */
export function chooseMode(plan: WeekPlan, date: string, slot: MealSlot, mode: Exclude<MealMode, 'cook'>,
  category: ReadyMealCategory | undefined, preferences: UserPreferences): WeekPlan {
  const day = dayOf(plan, date);
  if (!day || !day.slots.includes(slot)) throw Error('That meal is not planned for this day.');
  if (itemsOn(plan, date).some(item => item.mealSlot === slot)) return plan;
  const now = new Date().toISOString();
  const item: WeekPlanItem = { id: itemId(date, slot), date, mealSlot: slot, mealMode: mode,
    servings: plan.householdSize, ...(mode === 'eat_out' ? {} : { readyMealCategory: category }),
    meal: choicePlaceholder(mode, slot, category, { createdAt: now, updatedAt: now }) };
  return withTargets({ ...plan, status: 'review', items: [...plan.items, item] }, preferences);
}
/** Undo one decision. The slot stays chosen, so it shows up as open again. */
export const clearChoice = (plan: WeekPlan, date: string, slot: MealSlot, preferences: UserPreferences): WeekPlan =>
  withTargets({ ...plan, status: 'review',
    items: plan.items.filter(item => item.date !== date || item.mealSlot !== slot) }, preferences);
/** Skipping is an answer, not a gap: the household is not eating that meal at home. Skipping the
 *  only meal of a day means nothing is planned that day, so the day is unpicked with it. */
export function skipSlot(plan: WeekPlan, date: string, slot: MealSlot, preferences: UserPreferences): WeekPlan {
  const day = dayOf(plan, date);
  if (!day || !day.slots.includes(slot)) return plan;
  return day.slots.length === 1 ? toggleDay(plan, date, preferences) : toggleSlot(plan, date, slot, preferences);
}
export function confirmWeek(plan: WeekPlan, preferences: UserPreferences): WeekPlan {
  const confirmed = withTargets({ ...plan, status: 'confirmed' }, preferences);
  if (!plan.items.length) throw Error('Plan at least one meal before creating a basket.');
  if (!isWeekPlan(confirmed)) throw Error('This week cannot be saved. Check the planned days and meals.');
  return confirmed;
}
const sortDays = (plan: WeekPlan): WeekPlan =>
  ({ ...plan, days: weekDates(plan.weekStart).flatMap(date => plan.days.filter(day => day.date === date)) });
