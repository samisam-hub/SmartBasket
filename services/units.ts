/** Shopping quantities in the units the household actually buys in.
 *
 *  Only exact conversions are offered. Mass converts to ounces and pounds, fluid volume to fluid
 *  ounces and cups — all of those are defined constants. What is deliberately missing is grams to
 *  cups: that needs the density of each ingredient, which the catalog does not record, and a cup
 *  of flour and a cup of sugar are not the same weight. A number somebody shops by is not worth
 *  guessing at. */
import { t } from './i18n';

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
/** The number and unit somebody types a quantity in. One unit per system, so editing is
 *  reversible: grams and millilitres here, ounces and fluid ounces there — no jumping to pounds
 *  halfway through, which would turn 500 into 1.1 under the typing finger. */
export function editableQuantity({ amount, unit }: Quantity, system: UnitSystem,
  tin?: number | null): { value: number; label: string } {
  // Something sold only by the tin is counted in tins, in either system: the number somebody
  // corrects is the number of tins they put in the trolley, not the grams inside them.
  if (tin && tin > 0) {
    const tins = Math.max(1, Math.ceil(amount / tin - 0.001));
    return { value: tins, label: t('unit.tins', { count: tins }) };
  }
  if (system === 'metric') return { value: Math.round(amount), label: unit };
  const value = unit === 'g' ? amount / GRAMS_PER_OUNCE : amount / ML_PER_FLUID_OUNCE;
  return { value: Math.round(value * 10) / 10, label: unit === 'g' ? 'oz' : 'fl oz' };
}
/** The same number read back into grams or millilitres, which is what everything else counts in. */
export function quantityFromInput(value: number, unit: 'g' | 'ml', system: UnitSystem,
  tin?: number | null): number {
  if (tin && tin > 0) return Math.max(1, Math.round(value)) * tin;
  if (system === 'metric') return value;
  return unit === 'g' ? value * GRAMS_PER_OUNCE : value * ML_PER_FLUID_OUNCE;
}
/** The same quantity, written the way the household reads it. */
export function formatQuantity({ amount, unit }: Quantity, system: UnitSystem,
  tin?: number | null): string {
  if (!Number.isFinite(amount) || amount < 0) return `— ${unit}`;
  if (tin && tin > 0) {
    const tins = Math.max(1, Math.ceil(amount / tin - 0.001));
    return `${tins} ${t('unit.tins', { count: tins })}`;
  }
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
