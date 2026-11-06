import { ingredientPacks, ingredientPrices } from '../../data/ingredient-prices';
import { canonicalIngredientKey } from '../../data/ingredient-mappings';
import type { Meal } from '../../types/meal';

/** What an amount of one ingredient costs, to the cent. Prices are per kilogram and per litre, so
 *  grams and millilitres divide by a thousand alike. An ingredient nobody has priced returns null
 *  rather than nothing, so a list can say which lines its total leaves out. */
export function ingredientCost(key: string, amount: number): number | null {
  const rate = ingredientPrices[key] ?? ingredientPrices[canonicalIngredientKey(key)];
  if (rate === undefined || !Number.isFinite(amount) || amount <= 0) return null;
  return Math.round(rate * amount / 10) / 100;
}
/** What this ingredient costs to actually buy: whole packages, because a shop sells no half ones.
 *  240 g of chickpeas is one 240 g tin; 300 g of butter is two 250 g blocks and 200 g left over. */
export function packCost(key: string, amount: number): { packs: number; amount: number; cost: number } | null {
  const canonical = ingredientPrices[key] !== undefined ? key : canonicalIngredientKey(key);
  const pack = ingredientPacks[canonical];
  if (pack === undefined || !Number.isFinite(amount) || amount <= 0) return null;
  const packs = Math.ceil(amount / pack), bought = packs * pack;
  const cost = ingredientCost(canonical, bought);
  return cost === null ? null : { packs, amount: bought, cost };
}
/** What a set of chosen meals costs together: each dish's portion price times the portions of it.
 *  A dish without a price leaves the sum without one too, rather than quietly counting as free. */
export function choicesCost(items: { meal: Pick<Meal, 'ingredients' | 'servings'>; servings: number }[]): number | null {
  let total = 0;
  for (const item of items) {
    const portion = mealCostPerServing(item.meal);
    if (portion === null) return null;
    total += portion * item.servings;
  }
  return Math.round(total * 100) / 100;
}
/** What one portion of a dish costs on average. The recipe's amounts are for its own number of
 *  servings, so the sum is divided by them. A dish with an unpriced ingredient has no honest
 *  figure, so it gets none. */
export function mealCostPerServing(meal: Pick<Meal, 'ingredients' | 'servings'>): number | null {
  const servings = meal.servings > 0 ? meal.servings : 1;
  let total = 0;
  for (const ingredient of meal.ingredients) {
    const cost = ingredientCost(ingredient.ingredientKey, ingredient.quantity);
    if (cost === null) return null;
    total += cost;
  }
  return Math.round((total / servings) * 100) / 100;
}
