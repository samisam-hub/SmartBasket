import type { Allergen, Diet } from './preferences';
import type { ProductCategory } from './product';
export interface Nutrition { calories: number; protein: number; carbohydrates: number; fat: number }
export type MealSlot = 'breakfast' | 'lunch' | 'dinner' | 'snack';
export type MealMode = 'cook' | 'ready_to_eat' | 'heat_and_eat' | 'eat_out';
export type ReadyMealCategory = 'salad' | 'lasagne' | 'pasta' | 'asian' | 'pizza';
export interface ReadyMealMetadata {
  category: ReadyMealCategory;
  modes: ('ready_to_eat' | 'heat_and_eat')[];
  slots: MealSlot[];
  portionGrams: number;
  available: boolean;
  evidence: string;
}
export type IngredientGroup = 'protein' | 'vegetables' | 'fruit' | 'staples' | 'oil' | 'precise';
export interface IngredientDefinition {
  key: string; name: string; unit: 'g' | 'ml'; group: IngredientGroup; categories: ProductCategory[];
  aliases: string[]; exclude: string[]; nutritionPer100: Nutrition;
  diets: Diet[]; allergens: Allergen[];
}
export interface MealIngredient {
  ingredientKey: string; ingredientName: string; quantity: number; unit: 'g' | 'ml';
  flexible: boolean; minAdjustmentPercent: number; maxAdjustmentPercent: number; category: IngredientGroup;
}
export interface Meal {
  id: string; name: string; mealType: MealSlot; servings: number;
  caloriesPerServing: number; proteinPerServing: number; carbohydratesPerServing: number; fatPerServing: number;
  dietaryTags: Diet[]; allergens: Allergen[]; ingredients: MealIngredient[];
  nutritionSource: 'curated-development-estimate' | 'unrecorded'; createdAt: string; updatedAt: string;
}
export interface MealPlanItem {
  id: string; dayIndex: number; mealSlot: MealSlot; meal: Meal; servings: number;
  /** Missing mode means cook for existing saved plans. Non-cook meal is a display snapshot only. */
  mealMode?: MealMode;
  readyMealCategory?: ReadyMealCategory;
  readyMealMatch?: { productId: string; productName: string; quantity: number; nutrition: Nutrition };
}
export interface MealPlan {
  snacksIncluded?: boolean;
  participants?: import('./profile').PlanParticipant[];
  version: '1'; planningDays: number; householdSize: number; targetCalories: number; targetProtein: number;
  status: 'review' | 'confirmed'; items: MealPlanItem[]; warnings: { code: string; message: string }[];
}
export interface IngredientRequirement {
  ingredientKey: string; ingredientName: string; requiredQuantity: number; unit: 'g' | 'ml'; flexible: boolean;
  minimumAcceptableQuantity: number; maximumAcceptableQuantity: number; sourceMealIds: string[];
}
