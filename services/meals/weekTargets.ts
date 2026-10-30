import type { WeekPlan } from '../../types/meal';
import type { UserPreferences } from '../../types/preferences';
import { nutritionTargets } from '../basket/nutritionTargets';
import { slotCalorieShare } from './config';
import { itemGroup, itemsInSlot } from './weekPlan';

/** Open slots still need food for everyone. Decided slots count only their attending people,
 * including separate dishes, without counting a person twice. */
export function weekNutritionTargets(plan: WeekPlan, preferences: UserPreferences) {
  const people = plan.participants ?? preferences.participants;
  const daily = nutritionTargets({ ...preferences, participants: people, householdSize: plan.householdSize, planningDays: 1 });
  let calories = 0, protein = 0;
  for (const day of plan.days) for (const slot of day.slots) {
    const dishes = itemsInSlot(plan, day.date, slot);
    const all = !dishes.length || dishes.some(item => !item.participantIds);
    const ids = new Set(dishes.flatMap(item => itemGroup(plan, item)));
    const fraction = slotCalorieShare[slot];
    if (all) {
      calories += daily.calorieTarget * fraction;
      protein += daily.proteinTarget * fraction;
    } else if (people?.length) {
      for (const person of people) if (ids.has(person.id)) {
        calories += (person.dailyCalories ?? 0) * fraction;
        protein += (person.proteinTarget ?? 0) * fraction;
      }
    } else {
      calories += daily.calorieTarget * fraction * ids.size / plan.householdSize;
      protein += daily.proteinTarget * fraction * ids.size / plan.householdSize;
    }
  }
  return { ...daily, calorieTarget: calories || daily.calorieTarget * .08,
    proteinTarget: protein || daily.proteinTarget * .08 };
}
