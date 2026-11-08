import { t } from '../i18n';
import type { BasketGenerationResult, SavedBasket } from '../../types/basket';
import type { UserPreferences } from '../../types/preferences';
import { plannedDayCount } from '../meals/weekPlan';
export const basketDayCount = (result: BasketGenerationResult, preferences: UserPreferences) =>
  result.mealPlan ? plannedDayCount(result.mealPlan) : preferences.planningDays;
export const basketDisplayName = (basket: SavedBasket) => /^(?:\d+-day basket|Warenkorb für \d+ Tage?)$/.test(basket.name)
  ? t('basketName.days', { count: basketDayCount(basket.result, basket.preferences) }) : basket.name;
