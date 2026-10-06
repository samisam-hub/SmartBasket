import type { AnyMealPlan } from '../../types/meal';
import { plannedDayCount } from './weekPlan';

/** One consistent share for the whole meal: calories and protein cannot be split independently. */
export function participantPortions(plan: AnyMealPlan) {
  const people = plan.participants?.length === plan.householdSize ? plan.participants :
    Array.from({ length: plan.householdSize }, (_, i) => ({
      id: `person-${i}`, name: plan.householdSize === 1 ? 'You' : `Person ${i + 1}`,
      dailyCalories: plan.targetCalories / Math.max(1, plannedDayCount(plan)) / plan.householdSize,
      proteinTarget: plan.targetProtein / Math.max(1, plannedDayCount(plan)) / plan.householdSize,
    }));
  const total = people.reduce((sum, p) => sum + (p.dailyCalories ?? 0), 0);
  return people.map(p => ({ id: p.id, name: p.name,
    share: total > 0 ? (p.dailyCalories ?? 0) / total : 1 / people.length,
    calorieTarget: p.dailyCalories, proteinTarget: p.proteinTarget,
  }));
}

/** Only the people eating a meal share it. No list means the whole household, as before. */
export function portionsFor(plan: AnyMealPlan, participantIds?: string[]) {
  const all = participantPortions(plan);
  if (!participantIds?.length) return all;
  const present = all.filter(p => participantIds.includes(p.id));
  if (!present.length) return [];
  const total = present.reduce((sum, p) => sum + p.share, 0);
  return present.map(p => ({ ...p, share: total > 0 ? p.share / total : 1 / present.length }));
}
export function splitNutrition(plan: AnyMealPlan, nutrition: { calories: number; protein: number }, days = 1,
  participantIds?: string[]) {
  return portionsFor(plan, participantIds).map(p => ({ ...p,
    calories: nutrition.calories * p.share / days,
    protein: nutrition.protein * p.share / days,
  }));
}

/** Share of the original household amount, using the same weights as the plate portions. */
export function householdPortionShare(plan: AnyMealPlan, participantIds?: string[]): number {
  if (!participantIds) return 1;
  if (!plan.participants?.length) return participantIds.length / plan.householdSize;
  return participantPortions(plan).filter(person => participantIds.includes(person.id))
    .reduce((sum, person) => sum + person.share, 0);
}
