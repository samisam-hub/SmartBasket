import { meals } from '../../data/meals';
import type { MealSlot } from '../../types/meal';
import type { UserPreferences } from '../../types/preferences';
import { compatibleMeal, fitsSlot } from './planner';

/** Household taste only: allergies and dietary restrictions always take precedence. */
export const tasteSlotLabels: Record<MealSlot, string> = { breakfast: 'Frühstück', lunch: 'Mittagessen', dinner: 'Abendessen', snack: 'Snack' };
export type MealRatings = Record<string, boolean>;
export function validMealRatings(value: unknown): value is MealRatings {
  return !!value && typeof value === 'object' && !Array.isArray(value) &&
    Object.entries(value).every(([id, rating]) => id.length > 0 && id.length <= 100 && typeof rating === 'boolean');
}
export function tasteMeals(slot: MealSlot, preferences: UserPreferences) {
  return meals.filter(meal => fitsSlot(meal, slot) && compatibleMeal(meal, preferences));
}
