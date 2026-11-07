import * as catalog from './german-everyday-meals.json';
import * as internationalCatalog from './international-meals.json';
import * as internationalIngredients from './international-ingredients.json';
import * as referenceIngredients from './everyday-ingredients.json';
import type { IngredientDefinition, Meal, MealSlot, Nutrition } from '../types/meal';
import type { Allergen, Diet } from '../types/preferences';
import { quantityTolerances } from '../services/meals/config';

/** Editorial reference estimates, not manufacturer nutrition or verified allergen-free products. */
export const everydayIngredients = [...referenceIngredients.ingredients, ...internationalIngredients.ingredients] as IngredientDefinition[];

export function buildEverydayMeals(definitions: Record<string, IngredientDefinition>): Meal[] {
  return [...catalog.meals, ...internationalCatalog.meals].map(entry => {
    const date = ('createdAt' in entry && typeof entry.createdAt === 'string' ? entry.createdAt : undefined) ??
      (internationalCatalog.meals.some(meal => meal.id === entry.id) ? '2026-10-30T00:00:00Z' : '2026-10-21T00:00:00Z');
    const amounts = entry.amounts.map(line => {
      const ingredient = definitions[line.ingredientKey];
      if (!ingredient) throw new Error(`Unknown everyday ingredient: ${line.ingredientKey}`);
      const [min, max] = quantityTolerances[ingredient.group];
      return { ingredientKey: ingredient.key, ingredientName: ingredient.name,
        quantity: line.quantity / entry.recipeServings, unit: ingredient.unit,
        flexible: min !== 0 || max !== 0, minAdjustmentPercent: min,
        maxAdjustmentPercent: max, category: ingredient.group };
    });
    const nutrition: Nutrition = { calories: 0, protein: 0, carbohydrates: 0, fat: 0 };
    for (const line of amounts) {
      for (const key of Object.keys(nutrition) as (keyof Nutrition)[]) {
        nutrition[key] += definitions[line.ingredientKey].nutritionPer100[key] * line.quantity / 100;
      }
    }
    const diets: Diet[] = ['vegan', 'vegetarian', 'pescatarian', 'lactose_free', 'gluten_free'];
    return { id: entry.id, name: entry.name, mealType: entry.mealSlots[0] as MealSlot,
      mealSlots: entry.mealSlots as MealSlot[], servings: 1,
      caloriesPerServing: nutrition.calories, proteinPerServing: nutrition.protein,
      carbohydratesPerServing: nutrition.carbohydrates, fatPerServing: nutrition.fat,
      dietaryTags: diets.filter(diet => amounts.every(line => definitions[line.ingredientKey].diets.includes(diet))),
      allergens: [...new Set(amounts.flatMap(line => definitions[line.ingredientKey].allergens))] as Allergen[],
      ingredients: amounts, nutritionSource: 'curated-development-estimate',
      preparation: { activeMinutes: entry.activeMinutes, totalMinutes: entry.totalMinutes,
        referenceServings: entry.recipeServings, method: entry.method as NonNullable<Meal['preparation']>['method'],
        note: entry.preparationNote },
      createdAt: date, updatedAt: date };
  });
}
