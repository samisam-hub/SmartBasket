import type { AnyMealPlan, MealChoice, MealPlan, MealSlot, WeekPlan } from '../../types/meal';
import { mealSlots } from '../../types/meal';
import { ingredients } from '../../data/meals';
import {isParticipant} from '../profile-domain';
import { isCook, readyCategories } from './choices';
import { inWeek, isPlanDate, isWeekPlanShape, isWeekStart, sortSlots } from './weekPlan';
function validChoice(i: MealChoice) {
  if (isCook(i)) return i.readyMealCategory === undefined && i.readyMealMatch === undefined;
  if (!['ready_to_eat', 'heat_and_eat', 'eat_out'].includes(i.mealMode!) || i.meal?.nutritionSource !== 'unrecorded' || i.meal?.ingredients?.length !== 0) return false;
  if (i.mealMode === 'eat_out') return i.readyMealCategory === undefined && i.readyMealMatch === undefined;
  if (!i.readyMealCategory || !readyCategories(i.mealMode!, i.mealSlot).includes(i.readyMealCategory)) return false;
  const match = i.readyMealMatch;
  return !match || (typeof match.productId === 'string' && !!match.productId && typeof match.productName === 'string' &&
    Number.isFinite(match.quantity) && match.quantity > 0 && match.nutrition &&
    ['calories','protein','carbohydrates','fat'].every(k => Number.isFinite(match.nutrition[k as keyof typeof match.nutrition]) && match.nutrition[k as keyof typeof match.nutrition] >= 0));
}
/** Everything about one planned meal that holds in both plan shapes; the day itself is checked per shape.
 *  `people` are the plan's participant ids when it has any, so a meal cannot name a stranger. */
function validItem(i: MealChoice, people?: Set<string>): boolean {
  return !!i && typeof i.id === 'string' && mealSlots.includes(i.mealSlot) &&
    (i.participantIds === undefined || (Array.isArray(i.participantIds) && i.participantIds.length > 0 &&
      i.participantIds.length <= 10 && new Set(i.participantIds).size === i.participantIds.length &&
      i.participantIds.every(id => typeof id === 'string' && (!people || people.has(id))))) &&
    Number.isFinite(i.servings) && i.servings > 0 && i.servings <= 15 &&
    !!i.meal && typeof i.meal.id === 'string' && typeof i.meal.name === 'string' && i.meal.servings === 1 &&
    validChoice(i) && Array.isArray(i.meal.dietaryTags) && Array.isArray(i.meal.allergens) && Array.isArray(i.meal.ingredients) &&
    (!isCook(i) || i.meal.ingredients.length > 0) && i.meal.ingredients.length <= 12 &&
    i.meal.ingredients.every(l => l && ingredients[l.ingredientKey] &&
      typeof l.ingredientName === 'string' && l.unit === ingredients[l.ingredientKey].unit &&
      Number.isFinite(l.quantity) && l.quantity > 0 && l.quantity <= 2000 && typeof l.flexible === 'boolean' &&
      Number.isFinite(l.minAdjustmentPercent) && l.minAdjustmentPercent >= -20 && l.minAdjustmentPercent <= 0 &&
      Number.isFinite(l.maxAdjustmentPercent) && l.maxAdjustmentPercent >= 0 && l.maxAdjustmentPercent <= 20);
}
/** Shared by both shapes: the household, its people and the targets the plan was built against. */
function validHousehold(p: { participants?: unknown; householdSize: number; targetCalories: number; targetProtein: number;
  status: unknown; warnings: unknown }): boolean {
  return (p.participants === undefined || (Array.isArray(p.participants) && p.participants.length === p.householdSize && p.participants.every(isParticipant))) &&
    ['review','confirmed'].includes(p.status as string) && Number.isInteger(p.householdSize) && p.householdSize >= 1 && p.householdSize <= 10 &&
    [p.targetCalories,p.targetProtein].every(n => Number.isFinite(n) && n > 0) &&
    Array.isArray(p.warnings) && p.warnings.every(w => w && typeof w.code === 'string' && typeof w.message === 'string');
}
const planPeople = (plan: { participants?: { id: string }[] }): Set<string> | undefined =>
  plan.participants ? new Set(plan.participants.map(person => person.id)) : undefined;
export function isMealPlan(v: unknown): v is MealPlan {
  if(!v||typeof v!=='object')return false;const p=v as MealPlan;
  return validHousehold(p)&&p.version==='1'&&[3,5,7,14].includes(p.planningDays)&&
    (p.snacksIncluded===undefined||typeof p.snacksIncluded==='boolean')&&Array.isArray(p.items)&&p.items.length<=p.planningDays*4&&new Set(p.items.map(i=>i?.id)).size===p.items.length&&
    new Set(p.items.map(i=>`${i?.dayIndex}-${i?.mealSlot}`)).size===p.items.length&&
    p.items.every(i=>i&&Number.isInteger(i.dayIndex)&&i.dayIndex>=0&&i.dayIndex<p.planningDays&&validItem(i,planPeople(p)));
}
/** A calendar week: days may be missing and a planned day may leave chosen slots open,
 *  but every planned meal must sit on a day the household chose, in a slot it chose there. */
export function isWeekPlan(v: unknown): v is WeekPlan {
  if (!v || typeof v !== 'object') return false;
  const p = v as WeekPlan;
  if (!validHousehold(p) || p.version !== '2' || !isWeekStart(p.weekStart) || !Array.isArray(p.days) || p.days.length > 7) return false;
  const dates = p.days.map(day => day?.date);
  if (new Set(dates).size !== p.days.length) return false;
  if (!p.days.every(day => day && isPlanDate(day.date) && inWeek(p.weekStart, day.date) &&
    Array.isArray(day.slots) && day.slots.length > 0 && day.slots.length <= mealSlots.length &&
    new Set(day.slots).size === day.slots.length && day.slots.every(slot => mealSlots.includes(slot)))) return false;
  const chosen = new Map(p.days.map(day => [day.date, new Set<MealSlot>(day.slots)]));
  return Array.isArray(p.items) && p.items.length <= p.days.length * mealSlots.length &&
    new Set(p.items.map(i => i?.id)).size === p.items.length &&
    new Set(p.items.map(i => `${i?.date}-${i?.mealSlot}`)).size === p.items.length &&
    p.items.every(i => i && isPlanDate(i.date) && !!chosen.get(i.date)?.has(i.mealSlot) && validItem(i, planPeople(p)));
}
export const isAnyMealPlan = (v: unknown): v is AnyMealPlan => isMealPlan(v) || isWeekPlan(v);
/** Chosen slots of planned days that nobody has decided yet, in day and slot order. */
export function openPlanSlots(plan: AnyMealPlan): { date: string; slots: MealSlot[] }[] {
  if (!isWeekPlanShape(plan)) return [];
  return plan.days.map(day => ({ date: day.date,
    slots: sortSlots(day.slots).filter(slot => !plan.items.some(item => item.date === day.date && item.mealSlot === slot)) }))
    .filter(day => day.slots.length > 0);
}
