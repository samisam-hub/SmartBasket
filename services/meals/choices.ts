import { t , readyCategoryLabel } from '../i18n';
import { readyMealCategories, type AnyMealPlan, type Meal, type MealChoice, type MealMode, type MealSlot, type ReadyMealCategory, type ReadyMealMetadata } from '../../types/meal';

export const isCook = (item: Pick<MealChoice, 'mealMode'>) => !item.mealMode || item.mealMode === 'cook';
export function readyCategories(mode: MealMode, slot: MealSlot): ReadyMealCategory[] {
  if (mode !== 'ready_to_eat' && mode !== 'heat_and_eat') return [];
  // These five categories describe main meals, not breakfast or small snacks.
  if (slot === 'breakfast' || slot === 'snack') return [];
  return readyMealCategories.filter(() => true).filter(c => mode !== 'heat_and_eat' || c !== 'salad');
}
export function isReadyMealMetadata(value: unknown): value is ReadyMealMetadata {
  if (!value || typeof value !== 'object') return false;
  const v = value as ReadyMealMetadata;
  return (readyMealCategories as readonly string[]).includes(v.category) &&
    Array.isArray(v.modes) && v.modes.length > 0 && v.modes.every(m => ['ready_to_eat', 'heat_and_eat'].includes(m)) &&
    Array.isArray(v.slots) && v.slots.length > 0 && v.slots.every(s => ['breakfast', 'lunch', 'dinner', 'snack'].includes(s)) &&
    Number.isFinite(v.portionGrams) && v.portionGrams > 0 && v.portionGrams <= 2000 &&
    typeof v.available === 'boolean' && typeof v.evidence === 'string' && v.evidence.trim().length > 0;
}
/** A meal nobody cooks carries no recorded nutrition: never a guess, never a borrowed recipe. */
export function choicePlaceholder(mode: Exclude<MealMode, 'cook'>, slot: MealSlot, category: ReadyMealCategory | undefined,
  timestamps: { createdAt: string; updatedAt: string }): Meal {
  if (!['ready_to_eat', 'heat_and_eat', 'eat_out'].includes(mode)) throw Error(t('choices.invalid'));
  if (mode !== 'eat_out' && (!category || !readyCategories(mode, slot).includes(category))) throw Error(t('choices.categoryMismatch'));
  const name = mode === 'eat_out' ? t('choices.eatOut') : `${readyCategoryLabel(category!)} · ${mode === 'heat_and_eat' ? t('choices.heatAndEat') : "Verzehrfertig"}`;
  return { id: `choice:${mode}:${category ?? 'outside'}`, name, mealType: slot, servings: 1,
    ingredients: [], allergens: [], dietaryTags: [], caloriesPerServing: 0, proteinPerServing: 0,
    carbohydratesPerServing: 0, fatPerServing: 0, nutritionSource: 'unrecorded', ...timestamps };
}
/** Keeps the item's own day, whether that is a day number or a calendar date. */
export function replaceMealChoice<P extends AnyMealPlan>(plan: P, itemId: string, mode: Exclude<MealMode, 'cook'>, category?: ReadyMealCategory): P {
  const item = plan.items.find(i => i.id === itemId);
  if (!item) throw Error(t('choices.invalid'));
  const replacement = { ...item, mealMode: mode, servings: plan.householdSize,
    readyMealCategory: mode === 'eat_out' ? undefined : category,
    meal: choicePlaceholder(mode, item.mealSlot, category, { createdAt: item.meal.createdAt, updatedAt: item.meal.updatedAt }) };
  delete replacement.readyMealMatch;
  if (replacement.readyMealCategory === undefined) delete replacement.readyMealCategory;
  // Unknown nutrition is never redistributed into the other meals.
  return { ...plan, status: 'review', items: plan.items.map(i => i.id === itemId ? replacement : i) } as P;
}
export function mealNutritionKnown(item: MealChoice, ratios: Record<string, number> = {}) {
  return isCook(item) || !!(item.readyMealMatch && (ratios[`ready:${item.readyMealMatch.productId}`] ?? 1) > 0);
}
