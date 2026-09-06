import type { CatalogProductInput, ProductCategory } from "../../types/product";
import { normalizeOffImages } from "./off-images";
export const record = (v: unknown): Record<string, unknown> =>
  v !== null && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : {};
export function cleanText(v: unknown, limit = 500): string | null {
  if (typeof v !== "string") return null;
  const s = v.replace(/<[^>]*>/g, " ").replace(/[\u0000-\u001f]/g, " ").replace(/\s+/g, " ").trim();
  return s ? s.slice(0, limit) : null;
}
export function numberValue(v: unknown, max = 100): number | null {
  if (typeof v !== "number" && typeof v !== "string") return null;
  if (typeof v === "string" && !/^\d+(?:[.,]\d+)?$/.test(v.trim())) return null;
  const n = typeof v === "number" ? v : Number(v.replace(",", "."));
  return Number.isFinite(n) && n >= 0 && n <= max ? Math.round(n * 1000) / 1000 : null;
}
const tags = (v: unknown): string[] => Array.isArray(v)
  ? [...new Set(v.filter((t): t is string => typeof t === "string").map(t => t.toLowerCase()))] : [];
const categoryRules: [ProductCategory, string[]][] = [
  ["dairy-alternatives", ["milk-substitutes", "plant-milks", "plant-based-yogurts", "dairy-substitutes", "plant-based-milk-alternatives"]],
  ["eggs", ["eggs"]], ["fish", ["fishes", "fish", "seafood"]], ["meat", ["meats", "poultries"]],
  ["potatoes", ["potatoes"]], ["legumes", ["legumes", "tofu", "plant-based-meat-substitutes"]],
  ["pasta", ["pastas", "noodles"]], ["bread", ["breads"]],
  ["dairy", ["dairies", "cheeses", "yogurts", "milks"]],
  ["beverages", ["beverages"]], ["fruit", ["fruits"]], ["vegetables", ["vegetables"]],
  ["breakfast", ["breakfast-cereals", "breakfasts"]],
  ["grains", ["rices", "cereal-grains", "flours", "cereals-and-their-products"]],
  ["snacks", ["snacks", "desserts", "biscuits-and-cakes"]],
];
function categoryOf(values: string[]): ProductCategory {
  return categoryRules.find(([, keys]) => keys.some(k => values.includes(`en:${k}`)))?.[0] ?? "other";
}
const allergenMap: Record<string, string> = {
  "en:milk": "milk", "en:eggs": "eggs", "en:fish": "fish", "en:crustaceans": "shellfish",
  "en:molluscs": "shellfish", "en:peanuts": "peanuts", "en:nuts": "tree_nuts",
  "en:soybeans": "soy", "en:soy": "soy", "en:wheat": "wheat", "en:gluten": "gluten",
  "en:sesame-seeds": "sesame", "en:sesame": "sesame",
  "en:almonds": "tree_nuts", "en:hazelnuts": "tree_nuts", "en:walnuts": "tree_nuts",
  "en:cashew-nuts": "tree_nuts", "en:cashews": "tree_nuts", "en:pecan-nuts": "tree_nuts",
  "en:brazil-nuts": "tree_nuts", "en:pistachio-nuts": "tree_nuts", "en:macadamia-nuts": "tree_nuts",
  "en:shrimps": "shellfish", "en:prawns": "shellfish", "en:mussels": "shellfish",
};
export function normalizeAllergens(value: unknown): string[] {
  return [...new Set(tags(value).map(t => allergenMap[t] ?? t.replace(/^en:/, "")))].sort();
}
/** Use declared as-sold quantities only. Never copy estimated or prepared nutrients. */
function nutrition(p: Record<string, unknown>) {
  const n = record(p.nutrition);
  const sets = Array.isArray(n.input_sets) ? n.input_sets.map(record) : [];
  const set = sets.find(s => s.preparation === "as_sold" && s.source !== "estimate" &&
    (s.per === "100g" || s.per === "100ml") && numberValue(s.per_quantity ?? 100) === 100);
  const modern = sets.length > 0;
  const basis: "100g" | "100ml" = set?.per === "100ml" || (!modern && p.nutrition_data_per === "100ml") ? "100ml" : "100g";
  const nutrients = record(set?.nutrients), legacy = record(p.nutriments);
  const read = (key: string, max = 100) => {
    if (!modern) return numberValue(legacy[`${key}_100g`], max);
    const nutrient = record(nutrients[key]);
    if (nutrient.modifier && nutrient.modifier !== "=") return null;
    const expected = key === "energy-kcal" ? "kcal" : key === "energy-kj" ? "kJ" : "g";
    const value = numberValue(nutrient.value, expected === "g" && nutrient.unit === "mg" ? max * 1000 : max);
    if (value === null) return null;
    if (nutrient.unit === expected) return value;
    return expected === "g" && nutrient.unit === "mg" ? value / 1000 : null;
  };
  const kj = read("energy-kj", 3800) ?? (!modern && legacy.energy_unit === "kJ" ? numberValue(legacy.energy_100g, 3800) : null);
  const kcal = read("energy-kcal", 900) ?? (kj === null ? null : Math.round(kj / 4.184 * 100) / 100);
  return { nutritionBasis: basis, caloriesPer100g: kcal, proteinPer100g: read("proteins"),
    carbohydratesPer100g: read("carbohydrates"), fatPer100g: read("fat"),
    fiberPer100g: read("fiber"), sugarsPer100g: read("sugars"), saltPer100g: read("salt") };
}
export function normalizeOpenFoodFacts(raw: unknown): CatalogProductInput | null {
  const p = record(raw), code = typeof p.code === "string" ? p.code.trim() : "";
  const name = cleanText(p.product_name_en) ?? cleanText(p.product_name_de) ?? cleanText(p.product_name);
  if (!/^\d{8,14}$/.test(code) || !name || name.length < 2 || !/\p{L}/u.test(name)) return null;
  const nutrients = nutrition(p);
  if (nutrients.caloriesPer100g === null || [nutrients.proteinPer100g, nutrients.carbohydratesPer100g, nutrients.fatPer100g].every(v => v === null)) return null;
  const labelTags = tags(p.labels_tags), analysis = tags(p.ingredients_analysis_tags);
  const allergens = normalizeAllergens(p.allergens_tags);
  const has = (...t: string[]) => t.some(x => labelTags.includes(`en:${x}`));
  const diet = (key: string): boolean | null => analysis.includes(`en:non-${key}`) ? false
    : has(key) || analysis.includes(`en:${key}`) ? true : null;
  let vegan = diet("vegan"), vegetarian = diet("vegetarian");
  if (allergens.some(a => ["milk", "eggs", "fish", "shellfish"].includes(a))) vegan = vegan === true ? null : false;
  if (allergens.some(a => ["fish", "shellfish"].includes(a))) vegetarian = vegetarian === true ? null : false;
  if (vegan === true && vegetarian === false) vegan = null;
  if (vegan === true && vegetarian === null) vegetarian = true;
  const gluten = allergens.some(a => ["gluten", "wheat"].includes(a)), glutenLabel = has("gluten-free", "no-gluten");
  const qty = numberValue(p.product_quantity, 100000);
  const unit = p.product_quantity_unit === "g" || p.product_quantity_unit === "ml" ? p.product_quantity_unit : null;
  const grade = cleanText(p.nutriscore_grade ?? p.nutrition_grades);
  const canonicalCode = code.length === 14 && code.startsWith("0") ? code.slice(1) : code.padStart(13, "0");
  return {
    externalId: canonicalCode, barcode: canonicalCode, name, brand: cleanText(p.brands),
    category: categoryOf(tags(p.categories_tags)), ...normalizeOffImages(p, code),
    quantityLabel: cleanText(p.quantity), packageSize: unit && qty !== 0 ? qty : null, packageUnit: unit,
    priceEstimate: null, priceKind: "unavailable", currency: "EUR", ...nutrients,
    ingredientsText: cleanText(p.ingredients_text_en, 12000) ?? cleanText(p.ingredients_text_de, 12000) ?? cleanText(p.ingredients_text, 12000),
    allergens, mayContainAllergens: normalizeAllergens(p.traces_tags),
    allergenInfoAvailable: !!cleanText(p.ingredients_text) || allergens.length > 0,
    labels: labelTags.slice(0, 30).map(t => t.replace(/^en:/, "").replace(/-/g, " ")),
    vegetarian, vegan, lactoseFree: has("lactose-free", "no-lactose") ? true : null,
    glutenFree: gluten ? (glutenLabel ? null : false) : glutenLabel ? true : null,
    nutritionGrade: grade && /^[abcde]$/.test(grade) ? grade as CatalogProductInput["nutritionGrade"] : null,
    source: "open-food-facts", sourceUrl: `https://world.openfoodfacts.org/product/${code}`,
  };
}
