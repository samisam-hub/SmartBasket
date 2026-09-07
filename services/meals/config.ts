import type { IngredientGroup } from '../../types/meal';
/** Signed percentages. Only flexible recipe lines use these ranges. */
export const quantityTolerances: Record<IngredientGroup, readonly [number, number]> = {
  protein: [-10, 10], vegetables: [-15, 15], fruit: [-15, 15], staples: [-10, 10], oil: [-2, 2], precise: [0, 0],
};
export const packageWeights = Object.freeze({ deviation: 2, remaining: 3, price: 0.3, packages: 0.08, unavailablePrice: 0.35, quality: 0.05, compatibility:0.15 });
export const mealWeights = Object.freeze({ calories: 8, protein: 5, repetition: 0.8, sameDay: 3, reuse: 0.08, simplicity: 0.03, budget: 0.5, unavailable: 0.15 });
