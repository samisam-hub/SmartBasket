import type { Product, ProductCategory } from '../../types/product';
// Assumed total package amounts only when source package size is absent/piece-based.
const fallbackGrams: Record<ProductCategory, number> = {
  fruit: 1000, vegetables: 1000, meat: 500, fish: 400, eggs: 360, dairy: 500,
  'dairy-alternatives': 500, bread: 500, grains: 500, pasta: 500, potatoes: 1000,
  legumes: 400, breakfast: 500, snacks: 200, beverages: 1000, other: 500,
};
export function planPackage(p: Product) {
  const unit = p.nutritionBasis === '100ml' ? 'ml' as const : 'g' as const;
  if (p.packageSize !== null && (!Number.isFinite(p.packageSize) || p.packageSize <= 0 || p.packageSize > 20000)) return null;
  if (p.packageSize && (p.packageUnit === 'g' || p.packageUnit === 'ml')) {
    if (p.packageUnit !== unit) return null; // No density assumption to convert mass and volume.
    return { amount: p.packageSize, unit, assumed: false };
  }
  return { amount: unit === 'ml' ? 1000 : fallbackGrams[p.category] ?? 500, unit, assumed: true };
}
export function packagePrice(p: Product): number | null {
  return p.currency === 'EUR' && p.priceKind !== 'unavailable' && typeof p.priceEstimate === 'number' && Number.isFinite(p.priceEstimate) && p.priceEstimate >= 0.01 && p.priceEstimate <= 100000 ? p.priceEstimate : null;
}
