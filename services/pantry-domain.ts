import type { PantryLot, PantryState, PantryUse } from '../types/pantry';
import type { SavedBasket } from '../types/basket';
import type { IngredientRequirement } from '../types/meal';
import type { UserPreferences } from '../types/preferences';
import { diagnoseMatches } from './meals/matching';

export function allocatePantry(requirement: IngredientRequirement, lots: PantryLot[], preferences: UserPreferences): PantryUse[] {
  let need = requirement.requiredQuantity;
  const uses: PantryUse[] = [];
  for (const lot of [...lots].sort((a, b) => a.purchasedAt.localeCompare(b.purchasedAt) || a.id.localeCompare(b.id))) {
    if (need <= 0 || lot.unit !== requirement.unit || lot.quantity <= 0) continue;
    if (!diagnoseMatches(requirement.ingredientKey, [lot.product], preferences).candidates.length) continue;
    const quantity = Math.min(need, lot.quantity);
    uses.push({ lotId: lot.id, ingredientKey: requirement.ingredientKey, name: lot.product.name, quantity, unit: lot.unit });
    need -= quantity;
  }
  return uses;
}

export function checkoutPantry(state: PantryState, basket: SavedBasket, purchasedAt: string): PantryState {
  if (basket.result.purchasedAt) throw Error('This basket is already purchased.');
  const lots = structuredClone(state.lots);
  for (const use of basket.result.pantryUsed ?? []) {
    const lot = lots.find(l => l.id === use.lotId);
    if (!lot || lot.unit !== use.unit || !Number.isFinite(use.quantity) || use.quantity <= 0 || lot.quantity + .001 < use.quantity)
      throw Error('Your pantry changed. Refresh the basket before checkout.');
    lot.quantity = Math.max(0, lot.quantity - use.quantity);
  }
  for (const item of basket.result.items) {
    const quantity = item.leftoverQuantity ?? 0;
    if (quantity <= 0) continue;
    lots.push({ id: `${basket.id}:${item.product.id}`, product: item.product, ingredientKey: item.isExtra ? null : item.ingredientKey ?? null,
      quantity, unit: item.quantityUnit, purchasedAt, basketId: basket.id });
  }
  return { version: state.version + 1, lots: lots.filter(l => l.quantity > .001) };
}
