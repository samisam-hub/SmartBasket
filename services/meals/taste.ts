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

/** One pass of the taste run: the dishes shown one after another under a single heading.
 *
 *  Lunch and dinner share one pass because they share a taste: three quarters of the recipes fit
 *  both, and asking twice only showed the same dish again. Every dish belongs to exactly one pass,
 *  and a dish already rated is left out, so coming back continues instead of starting over. */
export interface TastePass { key: 'breakfast' | 'main' | 'snack'; slots: MealSlot[]; meals: Meal[] }
const passOrder: { key: TastePass['key']; slots: MealSlot[] }[] = [
  { key: 'breakfast', slots: ['breakfast'] },
  { key: 'main', slots: ['lunch', 'dinner'] },
  { key: 'snack', slots: ['snack'] },
];
/** A handful per meal is enough to tell what a household likes; a run through everything on the
 *  menu is a chore nobody finishes. Only the dishes actually shown are struck off for later passes. */
export const PER_PASS = 5;
export function tastePasses(preferences: UserPreferences, planned: MealSlot[], ratings: MealRatings = {},
  perPass: number = PER_PASS): TastePass[] {
  const seen = new Set<string>();
  return passOrder
    .map(pass => ({ ...pass, slots: pass.slots.filter(slot => planned.includes(slot)) }))
    .filter(pass => pass.slots.length)
    .map(pass => {
      const dishes = meals.filter(meal =>
        !seen.has(meal.id) && pass.slots.some(slot => fitsSlot(meal, slot)) && compatibleMeal(meal, preferences))
        .slice(0, perPass);
      for (const meal of dishes) seen.add(meal.id);
      return { ...pass, meals: dishes.filter(meal => ratings[meal.id] === undefined) };
    })
    .filter(pass => pass.meals.length);
}
