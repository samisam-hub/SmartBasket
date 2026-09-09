import type { BasketGenerationResult } from '../../types/basket';
import type { Product } from '../../types/product';
import { packagePrice } from './quantityPlanner';
import { recalculateBasket } from './edit';

export function addBasketProduct(original: BasketGenerationResult, product: Product): BasketGenerationResult {
  if (product.source === 'demo') throw Error('Demo fallback products cannot be added to saved baskets.');
  if (!product.packageSize || !['g', 'ml'].includes(product.packageUnit ?? '')) throw Error('This product needs a package size in g or ml before it can be added.');
  const result = structuredClone(original), size = product.packageSize, unit = product.packageUnit as 'g' | 'ml';
  const existing = result.items.find(i => i.product.id === product.id);
  if (existing) {
    // An extra package does not silently increase the portions in the meal plan.
    existing.packageCount++;
    if (!existing.isExtra) existing.extraPackageCount = (existing.extraPackageCount ?? 0) + 1;
    existing.purchasedQuantity = (existing.purchasedQuantity ?? existing.packageAmount * (existing.packageCount - 1)) + existing.packageAmount;
    existing.leftoverQuantity = (existing.leftoverQuantity ?? 0) + existing.packageAmount;
    if (existing.quantityUnit === 'g') existing.totalWeight = existing.purchasedQuantity;
    else existing.totalVolume = existing.purchasedQuantity;
    existing.estimatedPrice = existing.estimatedPrice === null ? null : existing.estimatedPrice / (existing.packageCount - 1) * existing.packageCount;
  } else {
    if (result.items.length >= (result.engineVersion === '2' ? 64 : 24)) throw Error('This basket has reached its product limit.');
    result.items.push({ product, isExtra: true, ingredientKey: `extra:${product.id}`, sourceMealIds: [], group: 'extras',
      packageCount: 1, packageAmount: size, quantityUnit: unit, quantityAssumed: product.packageSizeSource === 'smartbasket-synthetic-demo-v1',
      purchasedQuantity: size, plannedConsumptionQuantity: 0, leftoverQuantity: size,
      totalWeight: unit === 'g' ? size : null, totalVolume: unit === 'ml' ? size : null,
      totalCalories: 0, totalProtein: 0, totalCarbohydrates: 0, totalFat: 0, totalFiber: null,
      estimatedPrice: packagePrice(product), reasonSelected: [{ code: 'manual_extra', detail: 'Added by you outside the meal plan.' }] });
  }
  result.removedProductIds = result.removedProductIds?.filter(id => id !== product.id);
  return recalculateBasket(result);
}
