import type { BasketGenerationResult, SavedBasket } from '../../types/basket';
import type { UserPreferences } from '../../types/preferences';
import { plannedDayCount } from '../meals/weekPlan';
export const basketDayCount = (result: BasketGenerationResult, preferences: UserPreferences) =>
  result.mealPlan ? plannedDayCount(result.mealPlan) : preferences.planningDays;
export const basketDisplayName = (basket: SavedBasket) => /^(?:\d+-day basket|Warenkorb für \d+ Tage?)$/.test(basket.name)
  ? `Warenkorb für ${basketDayCount(basket.result, basket.preferences)} ${basketDayCount(basket.result, basket.preferences) === 1 ? "Tag" : "Tage"}` : basket.name;
