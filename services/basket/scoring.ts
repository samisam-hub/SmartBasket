import type { BasketGroup } from '../../types/basket';
import type { Product } from '../../types/product';
import type { UserPreferences } from '../../types/preferences';
import { packagePrice, planPackage } from './quantityPlanner';
export const weights = Object.freeze({ calories: 8, protein: 5, budget: 4, category: 3, diversity: 1.5, repetition: 0.6, extras: 2, quality: 0.08, unknownPrices: 0.02 });
export const limits = Object.freeze({ maxItems: 24, candidatesPerGroup: 14, iterations: 1600, refinementPasses: 12, maxCalorieShare: 0.35, maxExtrasShare: 0.1, maxBreakfastShare: 0.25 });
export const groupLabels: Record<BasketGroup, string> = { protein: 'Protein sources', vegetables: 'Vegetables', fruit: 'Fruit', staples: 'Carbohydrate staples', breakfast: 'Breakfast', dairy: 'Dairy / alternatives', extras: 'Snacks / extras' };
export const groups = Object.keys(groupLabels) as BasketGroup[];
export const requiredGroups: BasketGroup[] = ['protein', 'vegetables', 'fruit', 'staples'];
export function groupOf(p: Product): BasketGroup {
  // Do not let preserves/juice/oily prepared vegetables satisfy produce coverage.
  if (p.nutritionBasis === '100ml' || p.category === 'beverages') return p.category === 'dairy' || p.category === 'dairy-alternatives' ? 'dairy' : 'extras';
  if (['meat', 'fish', 'eggs', 'legumes'].includes(p.category)) return p.fatPer100g! > 30 ? 'extras' : 'protein';
  if (p.category === 'vegetables') return p.caloriesPer100g! <= 180 ? 'vegetables' : 'extras';
  if (p.category === 'fruit') return p.caloriesPer100g! <= 200 && (p.sugarsPer100g === null || p.sugarsPer100g <= 30) ? 'fruit' : 'extras';
  if (['bread', 'grains', 'pasta', 'potatoes'].includes(p.category)) return 'staples';
  if (p.category === 'breakfast') return p.sugarsPer100g !== null && p.sugarsPer100g > 20 ? 'extras' : 'breakfast';
  if (['dairy', 'dairy-alternatives'].includes(p.category)) return 'dairy';
  return 'extras';
}
export const coverageAmount = (g: BasketGroup, personDays: number) => ({ protein: 100, vegetables: 200, fruit: 150, staples: 100, breakfast: 0, dairy: 0, extras: 0 }[g] * personDays);
export function scoreProduct(p: Product, preferences: UserPreferences) {
  const pack = planPackage(p)!;
  const price = packagePrice(p);
  const factors = {
    proteinDensity: Math.min(1, p.proteinPer100g! * 4 / p.caloriesPer100g!),
    priceEfficiency: price === null ? 0 : Math.min(1, p.caloriesPer100g! * pack.amount / 100 / price / 1000),
    completeness: [p.fiberPer100g, p.sugarsPer100g, p.saltPer100g].filter(v => v !== null).length / 3,
    packagePracticality: pack.assumed ? 0 : 1,
    dietaryEvidence: preferences.dietaryPreferences.includes('none') ? 0.5 : 1,
    fiberDensity: p.fiberPer100g === null ? 0 : Math.max(0, Math.min(1, p.fiberPer100g / 6)),
  };
  return { factors, score: factors.proteinDensity * 25 + factors.priceEfficiency * 25 + factors.completeness * 15 + factors.packagePracticality * 15 + factors.dietaryEvidence * 10 + factors.fiberDensity * 10 };
}
