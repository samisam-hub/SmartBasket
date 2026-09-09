import type { BasketGenerationResult } from '../../types/basket';
import { mealNutrition, planNutrition } from '../meals/planner';

export function removeBasketProduct(original: BasketGenerationResult, productId: string): BasketGenerationResult {
  const result = structuredClone(original);
  result.items = result.items.filter(i => i.product.id !== productId);
  if (result.items.length === original.items.length) return result;
  result.removedProductIds = [...new Set([...(original.removedProductIds ?? []), productId])];
  result.removedIngredientKeys = [...new Set([...(original.removedIngredientKeys ?? []), ...original.items.filter(i => i.product.id === productId && i.ingredientKey && !result.items.some(j => j.ingredientKey === i.ingredientKey)).map(i => i.ingredientKey!)])];
  if (result.engineVersion === '1' && !result.items.length) throw Error('Keep at least one product in this older basket, or delete the basket instead.');
  return recalculateBasket(result, productId);
}

export function recalculateBasket(original: BasketGenerationResult, productId?: string): BasketGenerationResult {
  const result = structuredClone(original);
  const items = result.items;
  const sum = (key: 'totalCalories' | 'totalProtein' | 'totalCarbohydrates' | 'totalFat') => items.reduce((n, i) => n + i[key], 0);
  if (result.mealPlan && result.ingredientRequirements) {
    const ratios = Object.fromEntries(result.ingredientRequirements.map(r => [r.ingredientKey,
      (items.filter(i => i.ingredientKey === r.ingredientKey).reduce((n, i) => n + (i.plannedConsumptionQuantity ?? 0), 0) + (result.pantryUsed ?? []).filter(u => u.ingredientKey === r.ingredientKey).reduce((n,u) => n + u.quantity, 0)) / r.requiredQuantity]));
    result.ingredientRatios = ratios;
    const nutrition = planNutrition(result.mealPlan, ratios);
    result.totalCalories = nutrition.calories; result.totalProtein = nutrition.protein;
    result.totalCarbohydrates = nutrition.carbohydrates; result.totalFat = nutrition.fat;
    result.adjustedMealNutrition = result.mealPlan.items.map(i => ({ itemId: i.id, nutrition: mealNutrition(i, ratios) }));
    result.exclusions.unmatchedIngredients = Object.values(ratios).filter(n => n === 0).length;
    result.matchingDiagnostics = result.matchingDiagnostics?.map(d => ({ ...d,
      selectedProductIds: d.selectedProductIds.filter(id => id !== productId),
      unresolvedReason: ratios[d.ingredientKey] === 0 ? 'removed_or_unmatched' : d.unresolvedReason }));
  } else {
    result.totalCalories = sum('totalCalories'); result.totalProtein = sum('totalProtein');
    result.totalCarbohydrates = sum('totalCarbohydrates'); result.totalFat = sum('totalFat');
  }
  result.totalFiber = items.every(i => i.totalFiber !== null) ? items.reduce((n, i) => n + (i.totalFiber ?? 0), 0) : null;
  result.knownPriceSubtotal = Math.round(items.reduce((n, i) => n + (i.estimatedPrice ?? 0), 0) * 100) / 100;
  result.estimatedTotalPrice = items.every(i => i.estimatedPrice !== null) ? result.knownPriceSubtotal : null;
  result.budgetDifference = result.budgetTarget === null || result.estimatedTotalPrice === null ? null : result.estimatedTotalPrice - result.budgetTarget;
  result.budgetStatus = result.budgetTarget === null ? 'disabled' : result.budgetDifference === null ? 'price_incomplete' : result.budgetDifference <= 0 ? 'within_budget' : result.budgetDifference <= result.budgetTarget * .1 ? 'slightly_over' : 'over_budget';
  result.calorieCoveragePercent = result.calorieTarget ? result.totalCalories / result.calorieTarget * 100 : 0;
  result.proteinCoveragePercent = result.proteinTarget ? result.totalProtein / result.proteinTarget * 100 : 0;
  if (result.remaining) {
    const quantity = (key: 'purchasedQuantity' | 'plannedConsumptionQuantity' | 'leftoverQuantity', unit: string) => items.filter(i => i.quantityUnit === unit).reduce((n, i) => n + (i[key] ?? 0), 0);
    const purchased = quantity('purchasedQuantity', 'g'), leftover = quantity('leftoverQuantity', 'g');
    result.remaining = { totalPurchasedWeight: purchased, totalPlannedConsumption: quantity('plannedConsumptionQuantity', 'g'), totalLeftoverWeight: leftover,
      totalPurchasedVolume: quantity('purchasedQuantity', 'ml'), totalPlannedVolume: quantity('plannedConsumptionQuantity', 'ml'), totalLeftoverVolume: quantity('leftoverQuantity', 'ml'), estimatedWastePercent: purchased ? Math.round(leftover / purchased * 10000) / 100 : 0 };
  }
  result.categoryCoverage = result.categoryCoverage.map(c => ({ ...c, represented: items.some(i => i.group === c.group), amount: items.filter(i => i.group === c.group).reduce((n, i) => n + (i.totalWeight ?? 0), 0) }));
  result.status = items.length ? 'partial' : 'empty'; result.score = 0; result.objective = 0;
  result.warnings = result.warnings.filter(w => !['budget_exceeded', 'unknown_total', 'nutrition_gap', 'manual_edit'].includes(w.code) && !(productId && w.productIds?.includes(productId)));
  if (productId) result.warnings.push({ code: 'manual_edit', message: 'Products were removed. Totals cover the remaining products; planned meals may need missing ingredients.' });
  return result;
}
