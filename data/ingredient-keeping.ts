import { canonicalIngredientKey, ingredientMappings } from './ingredient-mappings';
import type { ProductCategory } from '../types/product';

/** How long an opened or fresh ingredient keeps in a normal household, in days.
 *
 *  This is what makes "use up the rest of the pack" a real plan instead of a wish: 450 g of
 *  spinach bought on Monday is worth planning again on Wednesday and worthless on Sunday. The
 *  numbers are deliberately careful — a household that throws nothing away is the goal, not one
 *  that eats on the last possible day. */
const byCategory: Record<ProductCategory, number> = {
  fish: 2, meat: 3, dairy: 7, 'dairy-alternatives': 7, eggs: 21,
  vegetables: 6, fruit: 7, potatoes: 30, bread: 4,
  grains: 180, pasta: 180, legumes: 180, breakfast: 120, snacks: 90, beverages: 90, other: 120,
};
/** Where the shelf matters more than the group: fresh herbs wilt in days whatever the catalogue
 *  files them under, and a tin keeps for years. */
const byIngredient: Record<string, number> = {
  parsley: 3, dill: 3, chives: 4, basil: 3, lettuce: 4, berries: 3, mushrooms: 4, chanterelles: 3,
  cherry_tomatoes: 7, fresh_tomato: 7, cucumber: 7, bell_pepper: 8, spinach: 4, leek: 10,
  broccoli: 6, carrots: 21, onion: 30, garlic: 60, apple: 21, banana: 5, lemon: 21,
  mince: 2, bratwurst: 4, wiener: 14, cold_cuts: 5, bacon: 10, chicken_ham: 5,
  salmon: 2, smoked_salmon: 7, fish_fingers: 180,
  milk: 7, cream: 10, sour_cream: 14, soy_cream: 60, yogurt: 10, plain_yogurt: 10, quark: 10,
  cottage: 7, cream_cheese: 14, cheese: 14, mozzarella: 10, butter: 30,
  tofu: 7, hummus: 5, pesto: 14, maultaschen: 7, cheese_tortellini: 14,
  fresh_gnocchi: 21, pizza_dough: 14, flammkuchen_dough: 14, applesauce: 14,
  // Tins, jars, oils and dry goods outlast any plan: they never force a second dish.
  chopped_tomatoes: 365, passata: 365, coconut_milk: 365, chickpeas: 365, kidney_beans: 365,
  corn: 365, tuna: 365, jam: 180, honey: 365, olive_oil: 365, sunflower_oil: 365, vinegar: 365,
};
export const KEEPS_FOREVER = 120;
/** How many days this ingredient is still worth planning with after it was bought. */
export function keepsDays(key: string): number {
  const canonical = byIngredient[key] !== undefined ? key : canonicalIngredientKey(key);
  const own = byIngredient[canonical];
  if (own !== undefined) return own;
  const category = ingredientMappings[canonical]?.allowedCategories[0];
  return category ? byCategory[category] ?? KEEPS_FOREVER : KEEPS_FOREVER;
}
/** Whether a leftover of this has to be eaten soon, or can wait for any day of the plan. */
export const perishable = (key: string): boolean => keepsDays(key) < KEEPS_FOREVER;
