/** Shopping quantities in the units the household actually buys in.
 *
 *  Only exact conversions are offered. Mass converts to ounces and pounds, fluid volume to fluid
 *  ounces and cups — all of those are defined constants. What is deliberately missing is grams to
 *  cups: that needs the density of each ingredient, which the catalog does not record, and a cup
 *  of flour and a cup of sugar are not the same weight. A number somebody shops by is not worth
 *  guessing at. */
export const unitSystems = ['metric', 'us'] as const;
export type UnitSystem = (typeof unitSystems)[number];
/** Missing on everything saved before this question existed, which means metric. */
export const unitSystemOf = (value: { unitSystem?: UnitSystem } | null | undefined): UnitSystem =>
  value?.unitSystem === 'us' ? 'us' : 'metric';
export const isUnitSystem = (value: unknown): value is UnitSystem =>
  typeof value === 'string' && (unitSystems as readonly string[]).includes(value);

// International avoirdupois and US customary, exact by definition.
const GRAMS_PER_OUNCE = 28.349523125;
const GRAMS_PER_POUND = 453.59237;
const ML_PER_FLUID_OUNCE = 29.5735295625;
const ML_PER_CUP = 236.5882365;
/** Shopping amounts, not laboratory ones: one decimal, and no trailing zero. */
const round = (value: number) => {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
};
export interface Quantity { amount: number; unit: 'g' | 'ml' }
/** The same quantity, written the way the household reads it. */
export function formatQuantity({ amount, unit }: Quantity, system: UnitSystem): string {
  if (!Number.isFinite(amount) || amount < 0) return `— ${unit}`;
  if (system === 'metric') return `${Math.round(amount)} ${unit}`;
  if (unit === 'g') {
    // A pound is the point where a shopper stops counting ounces.
    if (amount >= GRAMS_PER_POUND) return `${round(amount / GRAMS_PER_POUND)} lb`;
    return `${round(amount / GRAMS_PER_OUNCE)} oz`;
  }
  // Sixteen fluid ounces is one US pint, the same turning point for liquids.
  if (amount >= 16 * ML_PER_FLUID_OUNCE) return `${round(amount / ML_PER_CUP)} cups`;
  return `${round(amount / ML_PER_FLUID_OUNCE)} fl oz`;
}
