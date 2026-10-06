import type { MealMode, MealSlot, ReadyMealCategory, WeekPlan, WeekPlanItem } from '../../types/meal';
import { activeSlots, type UserPreferences } from '../../types/preferences';
import { nutritionTargets } from '../basket/nutritionTargets';
import { choicePlaceholder } from './choices';
import type { MealSuggestion } from './planner';
import { isWeekPlan } from './validation';
import {
  coveredInSlot, dayOf, emptyWeekPlan, groupsOverlap, inWeek, isWeekStart, itemGroup, itemsInSlot,
  plannedSlotShare, sortSlots, weekDates,
} from './weekPlan';

/** A slot usually holds one meal, named after it. A second one, for people eating something else,
 *  gets a numbered id so a changing group never renames an existing meal. */
function freeItemId(plan: WeekPlan, date: string, slot: MealSlot): string {
  const base = `${date}-${slot}`;
  if (!plan.items.some(item => item.id === base)) return base;
  for (let count = 2; count <= 10; count++) {
    const id = `${base}-${count}`;
    if (!plan.items.some(item => item.id === id)) return id;
  }
  throw Error('That meal already has as many separate dishes as people.');
}
/** The people a new meal is for: a named group has to exist in this plan, no list means everybody. */
function group(plan: WeekPlan, participantIds?: string[]): string[] | null {
  if (!participantIds) return null;
  const people = plan.participants?.map(person => person.id);
  if (!people) throw Error('Add the people of your household before splitting a meal.');
  if (participantIds.some(id => !people.includes(id))) throw Error('That person is not in this plan.');
  const named = people.filter(id => participantIds.includes(id));
  if (!named.length) throw Error('Choose at least one person for this meal.');
  return named.length === people.length ? null : named;
}
/** Somebody eating their own dish leaves the other meals of that slot; an abandoned one goes. */
function release(plan: WeekPlan, date: string, slot: MealSlot, leaving: string[], preferences: UserPreferences): WeekPlan {
  let next = plan;
  for (const item of itemsInSlot(plan, date, slot)) {
    const current = itemGroup(plan, item), remaining = current.filter(id => !leaving.includes(id));
    if (remaining.length === current.length) continue;
    next = remaining.length ? setPresence(next, item.id, remaining, preferences)
      : { ...next, items: next.items.filter(other => other.id !== item.id) };
  }
  return next;
}
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
/** The first yes wins for the people it is for: the household meal of a decided slot stays, and a
 *  second dish is only ever for people who are not eating the first one. */
export function chooseMeal(plan: WeekPlan, date: string, slot: MealSlot, suggestion: MealSuggestion,
  preferences: UserPreferences, participantIds?: string[]): WeekPlan {
  return addChoice(plan, date, slot, participantIds, preferences, (id, servings) =>
    ({ id, date, mealSlot: slot, meal: suggestion.meal, servings }), suggestion.servings);
}
function addChoice(plan: WeekPlan, date: string, slot: MealSlot, participantIds: string[] | undefined,
  preferences: UserPreferences, build: (id: string, servings: number) => WeekPlanItem,
  householdServings: number): WeekPlan {
  const day = dayOf(plan, date);
  if (!day || !day.slots.includes(slot)) throw Error('That meal is not planned for this day.');
  const eating = group(plan, participantIds);
  // Without a named group this is the household's meal, and a decided slot keeps the one it has.
  if (!eating) return itemsInSlot(plan, date, slot).length ? plan
    : add(plan, build(freeItemId(plan, date, slot), householdServings), undefined, preferences);
  if (!groupsOverlap(coveredInSlot(plan, date, slot), eating) && itemsInSlot(plan, date, slot).length)
    return plan;
  const freed = release(plan, date, slot, eating, preferences);
  const perPerson = householdServings / Math.max(1, plan.householdSize);
  return add(freed, build(freeItemId(freed, date, slot), perPerson * eating.length), eating, preferences);
}
const add = (plan: WeekPlan, item: WeekPlanItem, eating: string[] | undefined, preferences: UserPreferences) =>
  withTargets({ ...plan, status: 'review',
    items: [...plan.items, eating ? { ...item, participantIds: eating } : item] }, preferences);
/** The honest ways out of a slot: heating something up, buying it ready, or eating out. None of
 *  them carries recorded nutrition, and none of them is a cooked meal in disguise. */
export function chooseMode(plan: WeekPlan, date: string, slot: MealSlot, mode: Exclude<MealMode, 'cook'>,
  category: ReadyMealCategory | undefined, preferences: UserPreferences, participantIds?: string[]): WeekPlan {
  const now = new Date().toISOString();
  const meal = choicePlaceholder(mode, slot, category, { createdAt: now, updatedAt: now });
  return addChoice(plan, date, slot, participantIds, preferences, (id, servings) =>
    ({ id, date, mealSlot: slot, mealMode: mode, servings, meal,
      ...(mode === 'eat_out' ? {} : { readyMealCategory: category }) }), plan.householdSize);
}
/** Who eats this meal at home. Absent people get no portion and nothing bought for them; when
 *  nobody is left the slot is skipped, because an empty meal is not a meal. The quantity follows
 *  the heads at the table, the same basis the household size always used. */
export function setPresence(plan: WeekPlan, itemId: string, participantIds: string[],
  preferences: UserPreferences): WeekPlan {
  const item = plan.items.find(candidate => candidate.id === itemId);
  if (!item) throw Error('Choose a meal for this slot first.');
  const people = plan.participants?.map(person => person.id);
  if (people && participantIds.some(id => !people.includes(id))) throw Error('That person is not in this plan.');
  const present = people ? people.filter(id => participantIds.includes(id)) : [...new Set(participantIds)];
  const others = itemsInSlot(plan, item.date, item.mealSlot).filter(other => other.id !== item.id);
  // Nobody eats two meals in the same slot, so seating somebody here means freeing them there.
  if (present.length && others.some(other => groupsOverlap(itemGroup(plan, other), present)))
    throw Error('That person is already eating something else at this meal.');
  if (!present.length) {
    const without = { ...plan, items: plan.items.filter(other => other.id !== item.id) };
    // A slot nobody eats at home at all is skipped; one with other dishes simply loses this one.
    return others.length ? withTargets({ ...without, status: 'review' }, preferences)
      : skipSlot(without, item.date, item.mealSlot, preferences);
  }
  const before = item.participantIds?.length ?? plan.householdSize;
  const perPerson = item.servings / Math.max(1, before);
  const everyone = !others.length && present.length >= plan.householdSize;
  const updated: WeekPlanItem = { ...item, servings: perPerson * present.length };
  // The whole household is the default, so it is stored as no list at all.
  if (everyone) delete updated.participantIds; else updated.participantIds = present;
  return withTargets({ ...plan, status: 'review',
    items: plan.items.map(other => other.id === item.id ? updated : other) }, preferences);
}
/** Undo one decision. The slot stays chosen, so it shows up as open again. */
export const clearChoice = (plan: WeekPlan, itemId: string, preferences: UserPreferences): WeekPlan =>
  withTargets({ ...plan, status: 'review', items: plan.items.filter(item => item.id !== itemId) }, preferences);
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
