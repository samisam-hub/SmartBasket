import type { MealMode, MealPlan, MealPlanItem, MealSlot, ReadyMealCategory, ReadyMealMetadata } from '../../types/meal';

export const readyCategoryLabels: Record<ReadyMealCategory, string> = {
  salad: 'Salad', lasagne: 'Lasagne', pasta: 'Pasta', asian: 'Asian meal', pizza: 'Pizza',
};
export const modeLabels: Record<MealMode, string> = {
  cook: 'I want to cook', ready_to_eat: 'I don’t want to cook', heat_and_eat: 'I only want to heat it up', eat_out: 'I’m eating out',
};
export const isCook = (item: MealPlanItem) => !item.mealMode || item.mealMode === 'cook';
export function readyCategories(mode: MealMode, slot: MealSlot): ReadyMealCategory[] {
  if (mode !== 'ready_to_eat' && mode !== 'heat_and_eat') return [];
  // These five categories describe main meals, not breakfast or small snacks.
  if (slot === 'breakfast' || slot === 'snack') return [];
  return (Object.keys(readyCategoryLabels) as ReadyMealCategory[]).filter(c => mode !== 'heat_and_eat' || c !== 'salad');
}
export function isReadyMealMetadata(value: unknown): value is ReadyMealMetadata {
  if (!value || typeof value !== 'object') return false;
  const v = value as ReadyMealMetadata;
  return Object.hasOwn(readyCategoryLabels, v.category) &&
    Array.isArray(v.modes) && v.modes.length > 0 && v.modes.every(m => ['ready_to_eat', 'heat_and_eat'].includes(m)) &&
    Array.isArray(v.slots) && v.slots.length > 0 && v.slots.every(s => ['breakfast', 'lunch', 'dinner', 'snack'].includes(s)) &&
    Number.isFinite(v.portionGrams) && v.portionGrams > 0 && v.portionGrams <= 2000 &&
    typeof v.available === 'boolean' && typeof v.evidence === 'string' && v.evidence.trim().length > 0;
}
export function replaceMealChoice(plan: MealPlan, itemId: string, mode: Exclude<MealMode, 'cook'>, category?: ReadyMealCategory): MealPlan {
  const item = plan.items.find(i => i.id === itemId);
  if (!item || !['ready_to_eat', 'heat_and_eat', 'eat_out'].includes(mode)) throw Error('Invalid meal choice.');
  if (mode !== 'eat_out' && (!category || !readyCategories(mode, item.mealSlot).includes(category))) throw Error('This category does not fit this meal.');
  const name = mode === 'eat_out' ? 'Eating out' : `${readyCategoryLabels[category!]} · ${mode === 'heat_and_eat' ? 'Heat & eat' : 'Ready to eat'}`;
  const replacement: MealPlanItem = { id: item.id, dayIndex: item.dayIndex, mealSlot: item.mealSlot,
    mealMode: mode, ...(mode === 'eat_out' ? {} : { readyMealCategory: category }), servings: plan.householdSize,
    meal: { id: `choice:${mode}:${category ?? 'outside'}`, name, mealType: item.mealSlot, servings: 1,
      ingredients: [], allergens: [], dietaryTags: [], caloriesPerServing: 0, proteinPerServing: 0,
      carbohydratesPerServing: 0, fatPerServing: 0, nutritionSource: 'unrecorded', createdAt: item.meal.createdAt, updatedAt: item.meal.updatedAt } };
  // Unknown nutrition is never redistributed into the other meals.
  return { ...plan, status: 'review', items: plan.items.map(i => i.id === itemId ? replacement : i) };
}
export function mealNutritionKnown(item: MealPlanItem, ratios: Record<string, number> = {}) {
  return isCook(item) || !!(item.readyMealMatch && (ratios[`ready:${item.readyMealMatch.productId}`] ?? 1) > 0);
}
