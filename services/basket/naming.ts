import type { BasketGenerationResult, SavedBasket } from '../../types/basket';
import type { UserPreferences } from '../../types/preferences';
import { plannedDayCount } from '../meals/weekPlan';
export const basketDayCount = (result: BasketGenerationResult, preferences: UserPreferences) =>
  result.mealPlan ? plannedDayCount(result.mealPlan) : preferences.planningDays;
export const basketDisplayName = (basket: SavedBasket) => /^\d+-day basket$/.test(basket.name)
  ? `${basketDayCount(basket.result, basket.preferences)}-day basket` : basket.name;
