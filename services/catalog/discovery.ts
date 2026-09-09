import type { CatalogFilters, Product } from "../../types/product";
import type { UserPreferences } from "../../types/preferences";
export const dietaryFields = ["vegetarian", "vegan", "lactoseFree", "glutenFree"] as const;
export type DietaryField = (typeof dietaryFields)[number];
export const dietaryNames: Record<DietaryField, string> = {
  vegetarian: "Vegetarian", vegan: "Vegan", lactoseFree: "Lactose-free", glutenFree: "Gluten-free",
};
export const searchTokens = (query: string) => (query.slice(0, 120).toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []).slice(0, 8);
export const searchExpression = (query: string) => searchTokens(query).map(t => `${t}:*`).join(" & ");
export const highProtein = (p: Product) => p.caloriesPer100g !== null && p.caloriesPer100g > 0 &&
  p.proteinPer100g !== null && p.proteinPer100g * 4 >= p.caloriesPer100g * 0.2;
export function allergenTerms(preferences: UserPreferences | null): string[] {
  const selected: string[] = [...(preferences?.allergens ?? [])];
  // A generic gluten declaration cannot rule out wheat. Treat it as a warning.
  if (selected.includes("wheat")) selected.push("gluten");
  return selected;
}
export function allergenConflicts(p: Product, preferences: UserPreferences | null) {
  const terms = allergenTerms(preferences);
  return { contains: p.allergens.filter(a => terms.includes(a)),
    traces: p.mayContainAllergens.filter(a => terms.includes(a)) };
}
export function requiredDiet(preferences: UserPreferences | null): DietaryField[] {
  const map: Record<string, DietaryField> = { vegetarian: "vegetarian", vegan: "vegan", lactose_free: "lactoseFree", gluten_free: "glutenFree" };
  return (preferences?.dietaryPreferences ?? []).flatMap(d => map[d] ? [map[d]] : []);
}
export function hasDiscoveryPreferences(p: UserPreferences | null) {
  return !!p && (p.dietaryPreferences.some(d => d !== "none") || p.allergens.length > 0);
}
export function matchesPreferences(p: Product, preferences: UserPreferences | null) {
  if (!hasDiscoveryPreferences(preferences)) return false;
  if (requiredDiet(preferences).some(d => p[d] !== true)) return false;
  if (preferences?.dietaryPreferences.includes("pescatarian") && p.vegetarian !== true && p.category !== "fish") return false;
  const risk = allergenConflicts(p, preferences);
  if (risk.contains.length || risk.traces.length) return false;
  return !preferences?.allergens.length || p.allergenInfoAvailable;
}
export function productMatches(p: Product, query: string, filters: CatalogFilters, preferences: UserPreferences | null) {
  const words = `${p.name} ${p.brand ?? ""}`.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
  return searchTokens(query).every(t => words.some(w => w.startsWith(t))) &&
    (!filters.category || (filters.category === 'fruit-vegetables' ? ['fruit','vegetables'].includes(p.category) : filters.category === 'meat-fish' ? ['meat','fish'].includes(p.category) : filters.category === 'dairy-alternatives-group' ? ['dairy','dairy-alternatives'].includes(p.category) : filters.category === 'pantry' ? ['grains','pasta'].includes(p.category) : p.category === filters.category)) &&
    (!filters.highProtein || highProtein(p)) &&
    dietaryFields.every(f => !filters[f] || p[f] === true) &&
    (!filters.matchesPreferences || matchesPreferences(p, preferences));
}
export function estimatedPrice(p: Product): string {
  if (p.priceEstimate === null || p.priceKind === "unavailable") return "Price unavailable";
  try { return `Est. ${new Intl.NumberFormat("en-IE", { style: "currency", currency: p.currency }).format(p.priceEstimate)}`; }
  catch { return "Price unavailable"; }
}
