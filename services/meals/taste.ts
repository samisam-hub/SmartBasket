import { meals } from '../../data/meals';
import type { Meal, MealSlot } from '../../types/meal';
import type { UserPreferences } from '../../types/preferences';
import { compatibleMeal, fitsSlot } from './planner';
import { isFestiveMeal, mealFamilies, mealFamily, type MealFamily } from '../../data/meal-families';

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
 *  asked about the same dish twice in a run. Festive dishes get a pass of their own, and only
 *  when the household asks for one. */
export type TastePassKey = MealSlot | 'festive';
export interface TastePass { key: TastePassKey; slots: MealSlot[]; meals: Meal[] }
const passOrder: MealSlot[] = ['breakfast', 'lunch', 'dinner', 'snack'];
/** A handful per meal is enough to tell what a household likes; a run through the whole menu is a
 *  chore nobody finishes. Dishes already rated are not offered again: the next planning round
 *  therefore asks about the next ones, and the taste grows with every week planned. */
export const PER_PASS = 5;
/** One dish per kind, in turn, rather than the first five the catalogue happens to list.
 *  Five slices of bread in a row tell a household nothing about the menu; fried eggs, porridge,
 *  something on bread, yoghurt and pancakes tell it everything. */
function spread(dishes: Meal[], count: number): Meal[] {
  const byFamily = new Map<MealFamily, Meal[]>();
  for (const meal of dishes) {
    const family = mealFamily(meal);
    byFamily.set(family, [...(byFamily.get(family) ?? []), meal]);
  }
  const order = mealFamilies.filter(family => byFamily.has(family));
  const picked: Meal[] = [];
  for (let round = 0; picked.length < count && round < dishes.length; round++) {
    for (const family of order) {
      const meal = byFamily.get(family)![round];
      if (meal) picked.push(meal);
      if (picked.length >= count) break;
    }
  }
  return picked;
}
export function tastePasses(preferences: UserPreferences, planned: MealSlot[], ratings: MealRatings = {},
  perPass: number = PER_PASS, festive = false): TastePass[] {
  const seen = new Set<string>();
  const open = (meal: Meal) => !seen.has(meal.id) && compatibleMeal(meal, preferences) &&
    ratings[meal.id] === undefined;
  const passes: TastePass[] = passOrder
    .filter(slot => planned.includes(slot))
    .map(slot => {
      const dishes = spread(meals.filter(meal => !isFestiveMeal(meal) && fitsSlot(meal, slot) && open(meal)), perPass);
      for (const meal of dishes) seen.add(meal.id);
      return { key: slot as TastePassKey, slots: [slot], meals: dishes };
    });
  // The festive pass is asked for, never offered in passing: these dishes take an afternoon.
  if (festive) {
    const dishes = meals.filter(meal => isFestiveMeal(meal) && open(meal)).slice(0, perPass);
    if (dishes.length) passes.push({ key: 'festive', slots: ['lunch', 'dinner'], meals: dishes });
  }
  return passes.filter(pass => pass.meals.length);
}
/** Whether there is anything left to show in a festive pass at all. */
export const festiveTasteCount = (preferences: UserPreferences, ratings: MealRatings = {}): number =>
  meals.filter(meal => isFestiveMeal(meal) && compatibleMeal(meal, preferences) &&
    ratings[meal.id] === undefined).length;
