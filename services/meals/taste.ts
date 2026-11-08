import { meals } from '../../data/meals';
import type { Meal, MealSlot } from '../../types/meal';
import type { UserPreferences } from '../../types/preferences';
import { compatibleMeal, fitsSlot } from './planner';

/** Household taste only: allergies and dietary restrictions always take precedence. */
export type MealRatings = Record<string, boolean>;
export function validMealRatings(value: unknown): value is MealRatings {
  return !!value && typeof value === 'object' && !Array.isArray(value) &&
    Object.entries(value).every(([id, rating]) => id.length > 0 && id.length <= 100 && typeof rating === 'boolean');
}
export function tasteMeals(slot: MealSlot, preferences: UserPreferences) {
  return meals.filter(meal => fitsSlot(meal, slot) && compatibleMeal(meal, preferences));
}

/** One pass of the taste run: the dishes shown one after another under a single heading. Each
 *  meal of the day gets its own pass, and a dish belongs to exactly one of them, so nobody is
 *  asked about the same dish twice in a run. */
export interface TastePass { key: MealSlot; slots: MealSlot[]; meals: Meal[] }
const passOrder: MealSlot[] = ['breakfast', 'lunch', 'dinner', 'snack'];
/** A handful per meal is enough to tell what a household likes; a run through the whole menu is a
 *  chore nobody finishes. Dishes already rated are not offered again: the next planning round
 *  therefore asks about the next ones, and the taste grows with every week planned. */
export const PER_PASS = 5;
export function tastePasses(preferences: UserPreferences, planned: MealSlot[], ratings: MealRatings = {},
  perPass: number = PER_PASS): TastePass[] {
  const seen = new Set<string>();
  return passOrder
    .filter(slot => planned.includes(slot))
    .map(slot => {
      const dishes = meals.filter(meal => !seen.has(meal.id) && fitsSlot(meal, slot) &&
        compatibleMeal(meal, preferences) && ratings[meal.id] === undefined).slice(0, perPass);
      for (const meal of dishes) seen.add(meal.id);
      return { key: slot, slots: [slot], meals: dishes };
    })
    .filter(pass => pass.meals.length);
}
