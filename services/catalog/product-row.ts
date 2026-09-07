import { categories, type CatalogProductInput, type Product } from "../../types/product";
import { normalizePackage } from './package-size';
import { withMissingPriceEstimate } from '../pricing/priceEstimator';
export const productColumns = {
  externalId: "external_id", barcode: "barcode", name: "name", brand: "brand", category: "category",
  imageUrl: "image_url", imageThumbnailUrl: "image_thumbnail_url", quantityLabel: "quantity_label",
  sourceImageUrl: "source_image_url", displayImageUrl: "display_image_url", imageSource: "image_source",
  imageQuality: "image_quality", imageWidth: "image_width", imageHeight: "image_height",
  imageThumbnailWidth: "image_thumbnail_width", imageThumbnailHeight: "image_thumbnail_height",
  packageSize: "package_size", packageUnit: "package_unit", priceEstimate: "price_estimate",
  packageCountUnits: "package_count_units", packageSizeStatus: "package_size_status", packageSizeSource: "package_size_source",
  packageMassPerUnit: "package_mass_per_unit", packageDrainedWeight: "package_drained_weight",
  priceKind: "price_kind", currency: "currency", caloriesPer100g: "calories_per_100g",
  priceEstimateSource: "price_estimate_source", priceConfidence: "price_confidence", priceEstimateVersion: "price_estimate_version",
  proteinPer100g: "protein_per_100g", carbohydratesPer100g: "carbohydrates_per_100g",
  fatPer100g: "fat_per_100g", fiberPer100g: "fiber_per_100g", sugarsPer100g: "sugars_per_100g",
  saltPer100g: "salt_per_100g", nutritionBasis: "nutrition_basis", ingredientsText: "ingredients_text",
  allergens: "allergens", mayContainAllergens: "may_contain_allergens",
  allergenInfoAvailable: "allergen_info_available", labels: "labels", vegetarian: "vegetarian",
  vegan: "vegan", lactoseFree: "lactose_free", glutenFree: "gluten_free", nutritionGrade: "nutrition_grade",
  source: "source", sourceUrl: "source_url",
} satisfies Record<keyof CatalogProductInput, string>;
export function productToRow(product: CatalogProductInput): Record<string, unknown> {
  const fallback=normalizePackage({quantity:product.quantityLabel,name:product.name,size:product.packageSize,unit:product.packageUnit});
  return Object.fromEntries(Object.entries(productColumns).map(([key, column]) => [column, product[key as keyof CatalogProductInput]!==undefined?product[key as keyof CatalogProductInput]:(fallback as unknown as Record<string,unknown>)[key]??null]));
}
export function productFromRow(row: Record<string, unknown>): Product {
  if (typeof row.id !== "string" || typeof row.name !== "string" || typeof row.created_at !== "string" ||
    typeof row.updated_at !== "string" || typeof row.source !== "string" ||
    !categories.some(c => c === row.category) || !["100g", "100ml"].includes(String(row.nutrition_basis)))
    throw new Error("Malformed catalog row");
  for (const column of ["allergens", "may_contain_allergens", "labels"]) {
    const list = row[column];
    if (!Array.isArray(list) || !list.every(v => typeof v === "string")) throw new Error("Malformed catalog list");
  }
  for (const column of ["vegetarian", "vegan", "lactose_free", "gluten_free"])
    if (row[column] !== null && typeof row[column] !== "boolean") throw new Error("Malformed dietary flag");
  if(row.package_size_status!==undefined&&!['known','unknown','conflicting'].includes(String(row.package_size_status)))throw Error('Malformed package status');
  for(const column of ['package_count_units','package_mass_per_unit','package_drained_weight'])
    if(row[column]!==undefined&&row[column]!==null&&(typeof row[column]!=='number'||!Number.isFinite(row[column])||Number(row[column])<=0))throw Error('Malformed package metadata');
  if (!["usable", "low-resolution", "unknown", "missing"].includes(String(row.image_quality))) throw new Error("Malformed image quality");
  for (const column of ["image_width", "image_height", "image_thumbnail_width", "image_thumbnail_height"])
    if (row[column] !== null && (typeof row[column] !== "number" || !Number.isInteger(row[column]) || row[column] <= 0)) throw new Error("Malformed image dimensions");
  for (const column of ["price_estimate", "calories_per_100g", "protein_per_100g", "carbohydrates_per_100g", "fat_per_100g", "fiber_per_100g", "sugars_per_100g", "salt_per_100g"])
    if (row[column] !== null && (typeof row[column] !== "number" || !Number.isFinite(row[column]))) throw new Error("Malformed nutrition value");
  return { ...Object.fromEntries(Object.entries(productColumns).map(([key, column]) => [key, row[column]])),
    id: row.id, createdAt: row.created_at, updatedAt: row.updated_at } as Product;
}
/** JSON is SQL-literal escaped; never concatenate external values as SQL identifiers. */
export function catalogImportSql(products: CatalogProductInput[]): string {
  const columns = Object.values(productColumns);
  const json = JSON.stringify(products.map(withMissingPriceEstimate).map(productToRow)).replace(/'/g, "''");
  const updates = columns.filter(c => !["source", "external_id"].includes(c)).map(c => `${c} = excluded.${c}`).join(", ");
  return `insert into public.products (${columns.join(", ")}) select ${columns.join(", ")} from jsonb_populate_recordset(null::public.products, '${json}'::jsonb) on conflict (source, external_id) do update set ${updates};`;
}
