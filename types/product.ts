export const categories = ["fruit", "vegetables", "meat", "fish", "eggs", "dairy",
  "dairy-alternatives", "bread", "grains", "pasta", "potatoes", "legumes",
  "breakfast", "snacks", "beverages", "other"] as const;
export type ProductCategory = (typeof categories)[number];
export const categoryLabels: Record<ProductCategory, string> = {
  fruit: "Fruit", vegetables: "Vegetables", meat: "Meat", fish: "Fish", eggs: "Eggs",
  dairy: "Dairy", "dairy-alternatives": "Dairy alternatives", bread: "Bread",
  grains: "Grains", pasta: "Pasta", potatoes: "Potatoes", legumes: "Legumes",
  breakfast: "Breakfast", snacks: "Snacks", beverages: "Beverages", other: "Other",
};
/** Provider-neutral product. Null means unknown, never zero/false by default. */
export interface Product {
  id: string;
  externalId: string | null;
  barcode: string | null;
  name: string;
  brand: string | null;
  category: ProductCategory;
  imageUrl: string | null;
  imageThumbnailUrl: string | null;
  sourceImageUrl: string | null;
  displayImageUrl: string | null;
  imageSource: string | null;
  imageQuality: "usable" | "low-resolution" | "unknown" | "missing";
  imageWidth: number | null;
  imageHeight: number | null;
  imageThumbnailWidth: number | null;
  imageThumbnailHeight: number | null;
  priceEstimate: number | null;
  priceEstimateSource?: string | null;
  priceConfidence?: 'high' | 'medium' | 'low' | null;
  priceEstimateVersion?: string | null;
  currency: string;
  priceKind: "unavailable" | "demo-estimate" | "estimate";
  quantityLabel: string | null;
  packageSize: number | null;
  packageUnit: "g" | "ml" | "piece" | null;
  packageCountUnits?: number | null;
  packageSizeStatus?: "known" | "unknown" | "conflicting";
  packageSizeSource?: string | null;
  packageMassPerUnit?: number | null;
  packageDrainedWeight?: number | null;
  /** Values below use nutritionBasis, despite the legacy field names. */
  caloriesPer100g: number | null;
  proteinPer100g: number | null;
  carbohydratesPer100g: number | null;
  fatPer100g: number | null;
  fiberPer100g: number | null;
  sugarsPer100g: number | null;
  saltPer100g: number | null;
  nutritionBasis: "100g" | "100ml";
  ingredientsText: string | null;
  allergens: string[];
  mayContainAllergens: string[];
  allergenInfoAvailable: boolean;
  labels: string[];
  vegetarian: boolean | null;
  vegan: boolean | null;
  lactoseFree: boolean | null;
  glutenFree: boolean | null;
  nutritionGrade: "a" | "b" | "c" | "d" | "e" | null;
  source: string;
  sourceUrl: string | null;
  createdAt: string;
  updatedAt: string;
}
export type CatalogProductInput = Omit<Product, "id" | "createdAt" | "updatedAt">;
export interface CatalogFilters {
  category: ProductCategory | 'fruit-vegetables' | 'meat-fish' | 'dairy-alternatives-group' | 'pantry' | null;
  highProtein: boolean;
  vegetarian: boolean;
  vegan: boolean;
  lactoseFree: boolean;
  glutenFree: boolean;
  matchesPreferences: boolean;
}
export const emptyFilters: CatalogFilters = {
  category: null, highProtein: false, vegetarian: false, vegan: false,
  lactoseFree: false, glutenFree: false, matchesPreferences: false,
};
