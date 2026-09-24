import type { MealPlan, MealPlanItem, Nutrition, IngredientRequirement } from '../../types/meal';
import type { Product } from '../../types/product';
import type { UserPreferences } from '../../types/preferences';
import type { BasketItem, BasketWarning } from '../../types/basket';
import { skuSafety } from './skuSafety';
import { isReadyMealMetadata, readyCategories } from './choices';
import { packagePrice } from '../basket/quantityPlanner';

/** Never infer ready-to-eat or heating suitability from a name (e.g. dry lasagne sheets). */
export function readyMealCandidates(item: MealPlanItem, products: Product[], preferences: UserPreferences) {
  if (!item.readyMealCategory || !readyCategories(item.mealMode!, item.mealSlot).includes(item.readyMealCategory)) return [];
  return products.filter(p => {
    const meta = p.readyMeal;
    if (p.source === 'demo' || !isReadyMealMetadata(meta) || !meta.available || meta.category !== item.readyMealCategory ||
      !meta.modes.some(m => m === item.mealMode) || !meta.slots.includes(item.mealSlot)) return false;
    if (p.packageSizeStatus === 'conflicting' || p.packageUnit !== 'g' || !p.packageSize || !Number.isFinite(p.packageSize) || p.packageSize <= 0 || p.packageSize > 20000 ||
      p.nutritionBasis !== '100g' || p.currency !== 'EUR' || packagePrice(p) === null) return false;
    if ([p.caloriesPer100g, p.proteinPer100g, p.carbohydratesPer100g, p.fatPer100g].some(n => n === null || !Number.isFinite(n) || n < 0)) return false;
    if (!p.caloriesPer100g) return false;
    const safety = skuSafety(p, preferences);
    // Composite dishes need positive dietary evidence, not ingredient-level guesses.
    return !safety.rejection && safety.unknownDiet.length === 0;
  });
}

/** Called only by the confirmed-plan matcher. Re-matching always clears old selections. */
export function matchReadyMeals(plan: MealPlan, preferences: UserPreferences, products: Product[], remainingBudget: number | null) {
  const next: MealPlan = { ...plan, items: plan.items.map(i => { const copy = { ...i }; delete copy.readyMealMatch; return copy; }) };
  const requests = next.items.filter(i => i.mealMode === 'ready_to_eat' || i.mealMode === 'heat_and_eat');
  const warnings: BasketWarning[] = [], grouped = new Map<string, { product: Product; quantity: number; ids: string[] }>();
  let remaining = remainingBudget, unmatched = 0;
  requests.forEach((item, index) => {
    const budgetShare = remaining === null ? null : Math.max(0, remaining) / (requests.length - index);
    const candidates = readyMealCandidates(item, products, preferences).map(product => {
      const quantity = product.readyMeal!.portionGrams * plan.householdSize;
      const already = grouped.get(product.id)?.quantity ?? 0;
      const extraPackages = Math.ceil((already + quantity) / product.packageSize!) - Math.ceil(already / product.packageSize!);
      const price = extraPackages * packagePrice(product)!;
      const fraction = item.mealSlot === 'lunch' || item.mealSlot === 'dinner' ? .32 : .1;
      const target = plan.targetCalories / plan.planningDays * fraction;
      const score = (budgetShare === null ? 0 : Math.max(0, price - budgetShare) * 10) + price + Math.abs(product.caloriesPer100g! * quantity / 100 - target) / target;
      return { product, quantity, price, score };
    }).sort((a, b) => a.score - b.score || a.product.id.localeCompare(b.product.id));
    const selected = candidates[0];
    if (!selected) {
      unmatched++;
      warnings.push({ code: `unmatched_ready_${item.id}`, message: `Day ${item.dayIndex + 1} · ${item.mealSlot}: ${item.meal.name} could not be matched to a verified available catalog meal with suitable preparation, dietary/allergen evidence, price and portion data. No product was added; nutrition and cost are unknown.` });
      return;
    }
    const { product, quantity, price } = selected;
    if (remaining !== null) remaining -= price;
    const nutrition: Nutrition = { calories: product.caloriesPer100g! * quantity / 100, protein: product.proteinPer100g! * quantity / 100,
      carbohydrates: product.carbohydratesPer100g! * quantity / 100, fat: product.fatPer100g! * quantity / 100 };
    item.readyMealMatch = { productId: product.id, productName: product.name, quantity, nutrition };
    const group = grouped.get(product.id) ?? { product, quantity: 0, ids: [] };
    group.quantity += quantity; group.ids.push(item.id); grouped.set(product.id, group);
  });
  const items: BasketItem[] = [], requirements: IngredientRequirement[] = [];
  for (const { product, quantity, ids } of grouped.values()) {
    const key = `ready:${product.id}`, packageCount = Math.ceil(quantity / product.packageSize!), purchased = packageCount * product.packageSize!, factor = quantity / 100;
    requirements.push({ ingredientKey: key, ingredientName: product.name, requiredQuantity: quantity, unit: 'g', flexible: false,
      minimumAcceptableQuantity: quantity, maximumAcceptableQuantity: quantity, sourceMealIds: ids });
    items.push({ product, ingredientKey: key, sourceMealIds: ids, group: 'extras', packageCount, packageAmount: product.packageSize!, quantityUnit: 'g', quantityAssumed: false,
      purchasedQuantity: purchased, plannedConsumptionQuantity: quantity, leftoverQuantity: purchased - quantity, quantityAdjustmentPercent: 0,
      totalWeight: purchased, totalVolume: null, totalCalories: product.caloriesPer100g! * factor, totalProtein: product.proteinPer100g! * factor,
      totalCarbohydrates: product.carbohydratesPer100g! * factor, totalFat: product.fatPer100g! * factor, totalFiber: product.fiberPer100g === null ? null : product.fiberPer100g * factor,
      estimatedPrice: Math.round(packageCount * packagePrice(product)! * 100) / 100,
      reasonSelected: [{ code: 'ready_meal_match', detail: 'Catalog meal matched after confirmation using category, preparation, meal slot, dietary evidence, household portions and remaining budget.' }] });
  }
  return { plan: next, items, requirements, warnings, unmatched };
}
