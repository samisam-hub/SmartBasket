import type { BasketGenerationResult, BasketItem, BasketWarning } from '../types/basket';

/** Move only dietary uncertainty that can be attached to an existing product. */
export function productDietaryNotes(warnings: BasketWarning[], item: BasketItem) {
  return warnings.filter(warning => warning.code.startsWith('diet_uncertain_') &&
    (warning.productIds?.length ? warning.productIds.includes(item.product.id) :
      !!item.ingredientKey && warning.code === `diet_uncertain_${item.ingredientKey}`));
}
export function generalBasketNotes(result: BasketGenerationResult) {
  const attached = new Set(result.items.flatMap(item => productDietaryNotes(result.warnings, item)));
  return result.warnings.filter(warning => !attached.has(warning));
}
