import type { MealPlan } from '../../types/meal';

/** One consistent share for the whole meal: calories and protein cannot be split independently. */
export function participantPortions(plan: MealPlan) {
  const people = plan.participants?.length === plan.householdSize ? plan.participants :
    Array.from({ length: plan.householdSize }, (_, i) => ({
      id: `person-${i}`, name: plan.householdSize === 1 ? 'You' : `Person ${i + 1}`,
      dailyCalories: plan.targetCalories / plan.planningDays / plan.householdSize,
      proteinTarget: plan.targetProtein / plan.planningDays / plan.householdSize,
    }));
  const total = people.reduce((sum, p) => sum + (p.dailyCalories ?? 0), 0);
  return people.map(p => ({ id: p.id, name: p.name,
    share: total > 0 ? (p.dailyCalories ?? 0) / total : 1 / people.length,
    calorieTarget: p.dailyCalories, proteinTarget: p.proteinTarget,
  }));
}

export function splitNutrition(plan: MealPlan, nutrition: { calories: number; protein: number }, days = 1) {
  return participantPortions(plan).map(p => ({ ...p,
    calories: nutrition.calories * p.share / days,
    protein: nutrition.protein * p.share / days,
  }));
}
