import type { Allergen, Diet } from './preferences';
import type { ProductCategory } from './product';
export interface Nutrition { calories: number; protein: number; carbohydrates: number; fat: number }
export const mealSlots = ['breakfast', 'lunch', 'dinner', 'snack'] as const;
export type MealSlot = (typeof mealSlots)[number];
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
/** What was decided for one slot, without saying which day it belongs to. */
export interface MealChoice {
  id: string; mealSlot: MealSlot; meal: Meal; servings: number;
  /** Missing mode means cook for existing saved plans. Non-cook meal is a display snapshot only. */
  mealMode?: MealMode;
  readyMealCategory?: ReadyMealCategory;
  readyMealMatch?: { productId: string; productName: string; quantity: number; nutrition: Nutrition };
}
/** Version 1 item: days are counted from 0 over one uninterrupted planning period. */
export interface MealPlanItem extends MealChoice { dayIndex: number }
/** Version 2 item: planned for one calendar date, so a week can have gaps. */
export interface WeekPlanItem extends MealChoice { date: string }
export interface MealPlan {
  snacksIncluded?: boolean;
  participants?: import('./profile').PlanParticipant[];
  version: '1'; planningDays: number; householdSize: number; targetCalories: number; targetProtein: number;
  status: 'review' | 'confirmed'; items: MealPlanItem[]; warnings: { code: string; message: string }[];
}
/** One chosen day of the calendar: the slots the household plans to eat at home. */
export interface WeekPlanDay { date: string; slots: MealSlot[] }
/** Version 2 plan: the week the person filled in themselves. Days may be missing entirely,
 *  and a planned day may leave single slots open or deliberately unplanned. */
export interface WeekPlan {
  version: '2';
  /** ISO date of the Monday the week starts on. */
  weekStart: string;
  days: WeekPlanDay[];
  participants?: import('./profile').PlanParticipant[];
  householdSize: number; targetCalories: number; targetProtein: number;
  status: 'review' | 'confirmed'; items: WeekPlanItem[]; warnings: { code: string; message: string }[];
}
/** Saved plans keep their version; both shapes stay readable side by side. */
export type AnyMealPlan = MealPlan | WeekPlan;
export type AnyMealPlanItem = MealPlanItem | WeekPlanItem;
export interface IngredientRequirement {
  ingredientKey: string; ingredientName: string; requiredQuantity: number; unit: 'g' | 'ml'; flexible: boolean;
  minimumAcceptableQuantity: number; maximumAcceptableQuantity: number; sourceMealIds: string[];
}
