import type { Product } from '../../types/product';
import type { UserPreferences, Allergen } from '../../types/preferences';
import { allergenConflicts, highSugar, requiredDiet, sugarsUnknown } from '../catalog/discovery';
const freeLabels: Record<Allergen, string[]> = {
  milk: ['milk free', 'dairy free', 'no milk'], eggs: ['egg free', 'eggs free', 'no eggs'],
  fish: ['fish free', 'no fish'], shellfish: ['shellfish free'], peanuts: ['peanut free', 'peanuts free'],
  tree_nuts: ['tree nut free', 'tree nuts free', 'nut free', 'nuts free'], soy: ['soy free', 'soya free'],
  wheat: ['wheat free'], sesame: ['sesame free'],
};
export function exclusionReason(p: Product, preferences: UserPreferences): string | null {
  if (p.source === 'demo') return 'fictional_product';
  if (!p.id || !p.name || ![p.allergens, p.mayContainAllergens, p.labels].every(list => Array.isArray(list) && list.every(v => typeof v === 'string'))) return 'malformed_product';
  if (![p.caloriesPer100g, p.proteinPer100g, p.carbohydratesPer100g, p.fatPer100g].every(v => typeof v === 'number' && Number.isFinite(v) && v >= 0) ||
    p.caloriesPer100g! <= 0 || p.caloriesPer100g! > 900 || [p.proteinPer100g!, p.carbohydratesPer100g!, p.fatPer100g!].some(v => v > 100)) return 'insufficient_nutrition';
  if (!['100g', '100ml'].includes(p.nutritionBasis)) return 'unknown_nutrition_basis';
  if (p.proteinPer100g! + p.carbohydratesPer100g! + p.fatPer100g! > 105 ||
    (p.sugarsPer100g !== null && p.sugarsPer100g > p.carbohydratesPer100g! + 2)) return 'inconsistent_nutrition';
  const macroEnergy = 4 * (p.proteinPer100g! + p.carbohydratesPer100g!) + 9 * p.fatPer100g!;
  if (Math.abs(macroEnergy - p.caloriesPer100g!) > Math.max(40, p.caloriesPer100g! * 0.35)) return 'inconsistent_nutrition';
  // Broad sanity screen for mislabeled category/nutrition records, not inferred replacements.
  if ((p.category === 'fruit' && p.proteinPer100g! > 10) || (p.category === 'vegetables' && p.proteinPer100g! > 20)) return 'implausible_category_nutrition';
  const diets = preferences.dietaryPreferences;
  if (requiredDiet(preferences).some(d => p[d] !== true)) return 'diet_false_or_unknown';
  if ((diets.includes('vegetarian') || diets.includes('vegan')) && ['meat', 'fish'].includes(p.category)) return 'contradictory_diet';
  if (diets.includes('vegan') && (['dairy', 'eggs'].includes(p.category) || p.allergens.some(a => ['milk', 'eggs', 'fish', 'shellfish'].includes(a)))) return 'contradictory_diet';
  if (diets.includes('gluten_free') && p.allergens.some(a => ['wheat', 'gluten'].includes(a))) return 'contradictory_diet';
  // Diabetes-friendly is filtered on declared sugars only; an undeclared value is never treated as low.
  if (diets.includes('diabetes')) {
    if (sugarsUnknown(p)) return 'sugar_content_unknown';
    if (highSugar(p)) return 'contradictory_diet';
  }
  const labels = p.labels.map(l => l.toLowerCase().replace(/^en:/, '').replace(/[-_]/g, ' ').trim());
  if (diets.includes('pescatarian') && (p.category === 'meat' || (p.vegetarian !== true && !labels.includes('pescatarian')))) return 'pescatarian_unknown';
  const conflicts = allergenConflicts(p, preferences);
  if (conflicts.contains.length || conflicts.traces.length) return 'allergen_or_trace';
  // Ingredient text or an empty allergens array alone is not evidence of absence.
  if (preferences.allergens.length && (!p.allergenInfoAvailable || typeof p.ingredientsText !== 'string' || !p.ingredientsText.trim() ||
    preferences.allergens.some(a => !freeLabels[a].some(l => labels.includes(l))))) return 'allergen_safety_unknown';
  return null;
}
