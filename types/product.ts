/** Normalized catalog model. External providers map into this shape. */
export interface Product {
  id: string;
  externalId: string | null;
  barcode: string | null;
  name: string;
  brand: string;
  category: string;
  imageUrl: string | null;
  imagePlaceholder: string;
  priceEstimate: number | null;
  currency: string;
  packageLabel: string;
  caloriesPer100g: number | null;
  proteinPer100g: number | null;
  carbohydratesPer100g: number | null;
  fatPer100g: number | null;
  allergens: string[];
  labels: string[];
  vegetarian: boolean | null;
  vegan: boolean | null;
  lactoseFree: boolean | null;
  source: 'mock' | 'supabase' | 'open-food-facts';
}
