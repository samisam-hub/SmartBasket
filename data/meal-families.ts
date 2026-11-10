import { canonicalIngredientKey } from './ingredient-mappings';
import type { Meal } from '../types/meal';

/** What kind of dish this is, in the way a household thinks about food rather than the way a
 *  database groups it: fried eggs, something on bread, porridge, a pasta dish, a bake.
 *
 *  It exists because "five breakfasts" taken in catalogue order can be five slices of bread, and
 *  somebody who does not want bread then says the whole menu is nothing for them. Showing one
 *  dish per family instead covers the range in the same five cards. */
export const mealFamilies = ['festive', 'soup', 'bake', 'pasta', 'rice', 'potato', 'eggs',
  'porridge', 'dairy', 'sweet', 'bread', 'salad', 'pan', 'other'] as const;
export type MealFamily = (typeof mealFamilies)[number];

/** Dishes for a Sunday or a holiday: slow, expensive, and for a table with time at it. They are
 *  never suggested on a working Tuesday, and a household sees them only when it asks for them. */
export const festiveMealIds: readonly string[] = [
  'de-weihnachtsente-blaukraut-kartoffelknoedel',
  'de-herbstliches-hirschgulasch',
  'af-qabeli-palau-lamm',
];
export const isFestiveMeal = (meal: Pick<Meal, 'id'>): boolean => festiveMealIds.includes(meal.id);

const groups: { family: MealFamily; keys?: string[]; words?: RegExp }[] = [
  // What a dish is called decides first: a dish named after scrambled eggs is an egg dish even
  // when there are potatoes in the pan. Only then do the ingredients decide.
  { family: 'soup', words: /suppe|eintopf|borschtsch|brühe|soup|stew|gulasch|goulash/i },
  { family: 'bake', words: /auflauf|gratin|lasagne|pizza|flammkuchen|bake|quiche/i },
  { family: 'sweet', words: /pfannkuchen|arme ritter|pancake|french toast|milchreis|grießbrei|waffel/i },
  { family: 'eggs', words: /rührei|spiegelei|omelett|omelet|pochiert|gekochtes ei|scrambled|fried egg|boiled egg/i },
  { family: 'dairy', words: /joghurt|yoghurt|yogurt|quark|frischkäse|skyr|cottage/i },
  { family: 'salad', words: /salat|salad|rohkost/i },
  { family: 'bake', keys: ['lasagne_sheets', 'pizza_dough', 'flammkuchen_dough'] },
  { family: 'pasta', keys: ['pasta', 'noodles', 'soup_noodles', 'spaetzle', 'fresh_gnocchi',
    'cheese_tortellini', 'maultaschen'] },
  { family: 'rice', keys: ['rice', 'basmati_rice'] },
  { family: 'eggs', keys: ['eggs'] },
  { family: 'porridge', keys: ['oats', 'muesli', 'semolina', 'pudding_rice'] },
  { family: 'dairy', keys: ['yogurt', 'plain_yogurt', 'quark', 'cottage'] },
  { family: 'potato', keys: ['potatoes'] },
  { family: 'bread', keys: ['wholemeal_bread', 'sourdough_bread', 'bread_roll', 'toast', 'tortilla',
    'bake_roll'] },
  { family: 'pan', words: /pfanne|geschnetzeltes|stir|wok|curry|chili/i },
];/** Which ingredients carry the dish rather than season it: a pinch of parsley in a pasta dish
 *  does not make it a herb dish, and 20 g of breadcrumbs do not make a bake into bread. The
 *  amounts are for the whole recipe, so this is a low bar on purpose. */
const CARRIES = 30;
/** The one family this dish belongs to. The order above decides: a dish is named after the most
 *  particular thing about it, so a pasta bake is a bake and not pasta. */
export function mealFamily(meal: Pick<Meal, 'id' | 'name' | 'ingredients'>): MealFamily {
  if (isFestiveMeal(meal)) return 'festive';
  const carried = new Set(meal.ingredients.filter(line => line.quantity >= CARRIES)
    .flatMap(line => [line.ingredientKey, canonicalIngredientKey(line.ingredientKey)]));
  for (const group of groups) {
    if (group.words?.test(meal.name)) return group.family;
    if (group.keys?.some(key => carried.has(key))) return group.family;
  }
  return 'other';
}
/** The families present in a set of dishes, in the order above, so a run through them always
 *  offers the same kinds in the same sequence. */
export function familiesOf(dishes: Pick<Meal, 'id' | 'name' | 'ingredients'>[]): MealFamily[] {
  const present = new Set(dishes.map(mealFamily));
  return mealFamilies.filter(family => present.has(family));
}
