import { categoryLabel } from '../../services/i18n';
import { ingredientMappings, canonicalIngredientKey } from '../../data/ingredient-mappings';
import { ingredients } from '../../data/meals';
import type { BasketGenerationResult, BasketItem } from '../../types/basket';
import type { IngredientRequirement } from '../../types/meal';
import type { Product, ProductCategory } from '../../types/product';
import type { UserPreferences } from '../../types/preferences';
import { groupOf } from './scoring';
import { packagePrice, planPackage } from './quantityPlanner';
import { skuSafety } from '../meals/skuSafety';
import { recalculateBasket } from './edit';

export function replacementCandidates(products: readonly Product[], preferences: UserPreferences, categories: readonly ProductCategory[], currentId?: string) {
  const allowed = new Set(categories);
  return products.filter(product => product.id !== currentId && !product.readyMeal && product.source !== 'demo' && allowed.has(product.category) && planPackage(product) && !skuSafety(product, preferences).rejection)
    .sort((a, b) => (b.imageQuality === 'usable' ? 1 : 0) - (a.imageQuality === 'usable' ? 1 : 0) || (b.priceEstimate === null ? -1 : 1) - (a.priceEstimate === null ? -1 : 1) || a.name.localeCompare(b.name))
    .slice(0, 6);
}

export function replacementCandidatesForItem(item: BasketItem, products: readonly Product[], preferences: UserPreferences) {
  return replacementCandidates(products, preferences, [item.product.category], item.product.id);
}

export function replacementCandidatesForRequirement(requirement: IngredientRequirement, products: readonly Product[], preferences: UserPreferences) {
  const mapping = ingredientMappings[canonicalIngredientKey(requirement.ingredientKey)];
  return mapping ? replacementCandidates(products, preferences, mapping.allowedCategories) : [];
}

function packageFor(planned: number, product: Product) {
  const pack = planPackage(product);
  if (!pack || planned <= 0) return null;
  const packageCount = Math.max(1, Math.ceil(planned / pack.amount));
  return { ...pack, packageCount, purchased: packageCount * pack.amount, leftover: packageCount * pack.amount - planned };
}

export function replaceBasketProduct(original: BasketGenerationResult, currentId: string, product: Product) {
  const result = structuredClone(original);
  if (result.items.some(i => i.product.id === product.id && i.product.id !== currentId)) throw Error("Dieses Produkt ist bereits ausgewählt.");
  const item = result.items.find(candidate => candidate.product.id === currentId);
  if (!item || !item.ingredientKey) throw Error("Dieses Produkt kann im aktuellen Warenkorb nicht ausgetauscht werden.");
  const packed = packageFor(item.plannedConsumptionQuantity ?? item.packageAmount, product);
  if (!packed) throw Error("Die Alternative hat keine passende Packungsgröße.");
  const nutrition = ingredients[item.ingredientKey]?.nutritionPer100;
  if (!nutrition) throw Error("Für diese Zutat sind keine Nährwerte verfügbar.");
  const factor = (item.plannedConsumptionQuantity ?? item.packageAmount) / 100;
  const replacement: BasketItem = { ...item, product, group: groupOf(product), packageCount: packed.packageCount, packageAmount: packed.amount,
    quantityUnit: packed.unit, quantityAssumed: packed.assumed, purchasedQuantity: packed.purchased, leftoverQuantity: packed.leftover,
    totalWeight: packed.unit === 'g' ? packed.purchased : null, totalVolume: packed.unit === 'ml' ? packed.purchased : null,
    totalCalories: nutrition.calories * factor, totalProtein: nutrition.protein * factor, totalCarbohydrates: nutrition.carbohydrates * factor,
    totalFat: nutrition.fat * factor, totalFiber: null, estimatedPrice: packagePrice(product) === null ? null : packagePrice(product)! * packed.packageCount,
    reasonSelected: [{ code: 'manual_replacement', detail: `Ausgetauscht gegen ein anderes Produkt der Kategorie ${categoryLabel(product.category)} auf deinen Wunsch.` }] };
  result.excludedItems = result.excludedItems?.filter(i => i.product.id !== product.id);
  result.items = result.items.map(candidate => candidate.product.id === currentId ? replacement : candidate);
  result.removedProductIds = (result.removedProductIds ?? []).filter(id => id !== product.id);
  result.warnings = result.warnings.filter(w => w.code !== `unmatched_${item.ingredientKey}`);
  return recalculateBasket(result, currentId);
}

export function addBasketReplacement(original: BasketGenerationResult, requirement: IngredientRequirement, product: Product) {
  const packed = packageFor(requirement.requiredQuantity, product);
  const nutrition = ingredients[requirement.ingredientKey]?.nutritionPer100;
  if (!packed || !nutrition) throw Error("Die Alternative kann nicht hinzugefügt werden, weil Packungs- oder Nährwertangaben unvollständig sind.");
  const factor = requirement.requiredQuantity / 100;
  const item: BasketItem = { product, ingredientKey: requirement.ingredientKey, sourceMealIds: requirement.sourceMealIds, group: groupOf(product),
    packageCount: packed.packageCount, packageAmount: packed.amount, quantityUnit: packed.unit, quantityAssumed: packed.assumed,
    purchasedQuantity: packed.purchased, plannedConsumptionQuantity: requirement.requiredQuantity, leftoverQuantity: packed.leftover,
    quantityAdjustmentPercent: 0, totalWeight: packed.unit === 'g' ? packed.purchased : null, totalVolume: packed.unit === 'ml' ? packed.purchased : null,
    totalCalories: nutrition.calories * factor, totalProtein: nutrition.protein * factor, totalCarbohydrates: nutrition.carbohydrates * factor,
    totalFat: nutrition.fat * factor, totalFiber: null, estimatedPrice: packagePrice(product) === null ? null : packagePrice(product)! * packed.packageCount,
    reasonSelected: [{ code: 'manual_replacement', detail: `Hinzugefügt aus der Kategorie ${categoryLabel(product.category)} als Ersatz für ${requirement.ingredientName}.` }] };
  const result = structuredClone(original);
  if (result.items.some(i => i.product.id === product.id || i.ingredientKey === requirement.ingredientKey)) throw Error("Dieses Produkt oder diese Zutat ist bereits ausgewählt.");
  result.excludedItems = result.excludedItems?.filter(i => i.product.id !== product.id);
  result.removedProductIds = result.removedProductIds?.filter(id => id !== product.id);
  result.removedIngredientKeys = result.removedIngredientKeys?.filter(key => key !== requirement.ingredientKey);
  result.items.push(item);
  result.warnings = result.warnings.filter(w => w.code !== `unmatched_${requirement.ingredientKey}`);
  return recalculateBasket(result);
}
