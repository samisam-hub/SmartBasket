import type { Product } from './product';
import type { UserPreferences } from './preferences';
import type { MealPlan, IngredientRequirement, Nutrition } from './meal';
export type BasketGroup = 'protein' | 'vegetables' | 'fruit' | 'staples' | 'breakfast' | 'dairy' | 'extras';
export interface BasketWarning { code: string; message: string; productIds?: string[] }
export interface SelectionReason { code: string; detail: string }
export interface BasketItem {
  ingredientKey?: string;
  sourceMealIds?: string[];
  purchasedQuantity?: number;
  plannedConsumptionQuantity?: number;
  leftoverQuantity?: number;
  quantityAdjustmentPercent?: number;
  product: Product;
  group: BasketGroup;
  packageCount: number;
  packageAmount: number;
  quantityUnit: 'g' | 'ml';
  quantityAssumed: boolean;
  totalWeight: number | null;
  totalVolume: number | null;
  totalCalories: number;
  totalProtein: number;
  totalCarbohydrates: number;
  totalFat: number;
  totalFiber: number | null;
  estimatedPrice: number | null;
  reasonSelected: SelectionReason[];
}
export interface BasketGenerationResult {
  engineVersion: '1' | '2';
  mealPlan?: MealPlan;
  ingredientRequirements?: IngredientRequirement[];
  ingredientRatios?: Record<string, number>;
  matchingDiagnostics?: {ingredientKey:string;candidatesFound:number;rejected:Record<string,number>;eligibleProductIds:string[];selectedProductIds:string[];unresolvedReason:string|null}[];
  adjustedMealNutrition?: { itemId: string; nutrition: Nutrition }[];
  remaining?: { totalPurchasedWeight: number; totalPlannedConsumption: number; totalLeftoverWeight: number; totalPurchasedVolume: number; totalPlannedVolume: number; totalLeftoverVolume: number; estimatedWastePercent: number };
  optimizationWeights: Record<string, number>;
  status: 'generated' | 'partial' | 'empty' | 'invalid';
  items: BasketItem[];
  totalCalories: number;
  totalProtein: number;
  totalCarbohydrates: number;
  totalFat: number;
  totalFiber: number | null;
  estimatedTotalPrice: number | null;
  knownPriceSubtotal: number;
  calorieTarget: number;
  proteinTarget: number;
  dailyProteinTarget: number;
  proteinRule: string;
  budgetTarget: number | null;
  budgetDifference: number | null;
  budgetStatus: 'disabled' | 'unknown' | 'within_budget' | 'slightly_over' | 'unachievable' | 'over_budget' | 'price_incomplete';
  calorieCoveragePercent: number;
  proteinCoveragePercent: number;
  categoryCoverage: { group: BasketGroup; required: boolean; available: boolean; represented: boolean; amount: number; targetAmount: number }[];
  warnings: BasketWarning[];
  constraintsApplied: string[];
  exclusions: Record<string, number>;
  score: number;
  objective: number;
  iterations: number;
}
export interface SavedBasket {
  id: string;
  cloudId: string | null;
  ownerId: string | null;
  name: string;
  createdAt: string;
  preferences: UserPreferences;
  result: BasketGenerationResult;
  syncStatus: 'local' | 'synced';
}
