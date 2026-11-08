import { t } from '../i18n';
import type { BasketGenerationResult } from '../../types/basket';
import type { Product } from '../../types/product';
import { packagePrice } from './quantityPlanner';
import { recalculateBasket, toggleBasketProduct } from './edit';

export function addBasketProduct(original: BasketGenerationResult, product: Product): BasketGenerationResult {
  if (original.excludedItems?.some(i => i.product.id === product.id)) return toggleBasketProduct(original, product.id);
  if (product.source === 'demo') throw Error(t('basket.noDemoProducts'));
  if (!product.packageSize || !['g', 'ml'].includes(product.packageUnit ?? '')) throw Error(t('basket.needsPackageSize'));
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
    if (result.items.length >= (result.engineVersion === '2' ? 64 : 24)) throw Error(t('basket.maxProducts'));
    result.items.push({ product, isExtra: true, ingredientKey: `extra:${product.id}`, sourceMealIds: [], group: 'extras',
      packageCount: 1, packageAmount: size, quantityUnit: unit, quantityAssumed: product.packageSizeSource === 'smartbasket-synthetic-demo-v1',
      purchasedQuantity: size, plannedConsumptionQuantity: 0, leftoverQuantity: size,
      totalWeight: unit === 'g' ? size : null, totalVolume: unit === 'ml' ? size : null,
      totalCalories: 0, totalProtein: 0, totalCarbohydrates: 0, totalFat: 0, totalFiber: null,
      estimatedPrice: packagePrice(product), reasonSelected: [{ code: 'manual_extra', detail: t('basket.addedByYou') }] });
  }
  result.removedProductIds = result.removedProductIds?.filter(id => id !== product.id);
  return recalculateBasket(result);
}
