import type { BasketGenerationResult } from '../../types/basket';
import { emptyFilters, type Product } from '../../types/product';
import type { UserPreferences } from '../../types/preferences';
import { productMatches } from '../catalog/discovery';
import { matchProducts, uniqueCatalog } from '../meals/matching';

/** A product can only be added if it carries the package data the basket needs, and demo
 *  fallbacks never enter a real basket. Offering anything else would fail on the tap. */
export const addableToBasket = (product: Product): boolean =>
  product.source !== 'demo' && !!product.packageSize && Number.isFinite(product.packageSize) &&
  ['g', 'ml'].includes(product.packageUnit ?? '');
const inBasket = (result: BasketGenerationResult, product: Product) =>
  result.items.some(item => item.product.id === product.id);
/** Free search over the catalog already loaded for this basket; no new query, no guessing. */
export function addableProducts(catalog: Product[], query: string, limit = 6): Product[] {
  if (query.trim().length < 2) return [];
  return catalog.filter(product => addableToBasket(product) && productMatches(product, query, emptyFilters, null))
    .slice(0, limit);
}
/** The fixed "always with me" list of this version. Learning it from earlier baskets comes later,
 *  so these are curated staples, matched through the same safety rules as any planned ingredient. */
export const stapleIngredientKeys = ['bread', 'eggs', 'yogurt', 'apple', 'oil'] as const;
export interface StapleSuggestion { key: string; product: Product }
export function stapleSuggestions(catalog: Product[], preferences: UserPreferences,
  result: BasketGenerationResult): StapleSuggestion[] {
  const products = uniqueCatalog(catalog);
  return stapleIngredientKeys.flatMap(key => {
    const product = matchProducts(key, products, preferences).find(candidate =>
      addableToBasket(candidate) && !inBasket(result, candidate));
    return product ? [{ key, product }] : [];
  });
}
