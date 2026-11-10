import { ingredientPacks } from '../../data/ingredient-prices';
import { canonicalIngredientKey } from '../../data/ingredient-mappings';
import { keepsDays, perishable } from '../../data/ingredient-keeping';
import { mealFamily } from '../../data/meal-families';
import { mealWeights } from './config';
import type { Meal, MealChoice, WeekPlan } from '../../types/meal';

/** How much the plan leans on using things up rather than on variety.
 *
 *  "off" plans as before. "balanced" prefers a dish that finishes an open pack and keeps red meat
 *  to about once a week. "strict" goes further and is meant for a one-person household, where a
 *  450 g bag of spinach is three meals whether they are planned or not. */
export const sustainabilityLevels = ['off', 'balanced', 'strict'] as const;
export type SustainabilityLevel = (typeof sustainabilityLevels)[number];
export const isSustainabilityLevel = (value: unknown): value is SustainabilityLevel =>
  typeof value === 'string' && (sustainabilityLevels as readonly string[]).includes(value);
/** What a household gets when it has said nothing: plan sensibly, do not lecture. */
export const DEFAULT_SUSTAINABILITY: SustainabilityLevel = 'balanced';

/** The weights the level turns into. A small household wastes most, because the packs are the
 *  same size for everybody, so the same level leans harder the fewer people eat from them. */
export function sustainabilityWeights(level: SustainabilityLevel, householdSize: number) {
  if (level === 'off') return { leftover: 0, leftoverCap: 0, repeatRelief: 0, redMeat: 0, meatFreeDays: 0, meatFree: 0 };
  // One person: a pack is three meals. Four people: a pack is one meal, and variety matters more.
  const small = Math.max(0.5, Math.min(2, 3 / Math.max(1, householdSize)));
  const strict = level === 'strict';
  return {
    /** Per 100 g of an open pack a dish would use up. Deliberately small: the score is capped
     *  below what a liking is worth, so the gradient has to stay inside that ceiling to mean
     *  anything at all. */
    leftover: (strict ? 0.5 : 0.25) * small,
    /** The most a dish can gain by using things up. Below what a liking is worth, so taste keeps
     *  the last word; a household that asked for strict planning lets thrift weigh more. */
    leftoverCap: strict ? mealWeights.liked / 2 : mealWeights.liked / 4,
    /** How much of the repetition penalty a dish that reheats well gets back on the next day.
     *  A single person cooks the same pot twice as a matter of course; a family of four rarely
     *  needs to, because one pot is already one meal. */
    repeatRelief: Math.max(0, Math.min(1, (strict ? 1 : 0.6) * small)),
    /** Penalty for a second beef or lamb dish in the same week. */
    redMeat: strict ? 6 : 3,
    /** Meat-free days the week is aimed at, and the nudge towards reaching them. */
    meatFreeDays: strict ? 4 : 2,
    meatFree: strict ? 4 : 2.5,
  };
}

/** Beef, lamb, venison and duck cost several times what any other protein costs in land, water
 *  and emissions. Everything else is counted simply as meat or as meat-free, because that is the
 *  distinction a household can act on. */
const redMeatKeys = new Set(['beef_steak', 'beef_stew', 'mince', 'lamb_stew', 'venison_stew',
  'duck_breast']);
const meatKeys = new Set([...redMeatKeys, 'chicken_breast', 'chicken_thigh', 'turkey', 'bacon',
  'bratwurst', 'wiener', 'cold_cuts', 'chicken_ham', 'pork_schnitzel', 'salmon', 'smoked_salmon',
  'tuna', 'fish_fingers', 'maultaschen']);
export const hasRedMeat = (meal: Pick<Meal, 'ingredients'>): boolean =>
  meal.ingredients.some(line => redMeatKeys.has(canonicalIngredientKey(line.ingredientKey)) ||
    redMeatKeys.has(line.ingredientKey));
export const hasMeat = (meal: Pick<Meal, 'ingredients'>): boolean =>
  meal.ingredients.some(line => meatKeys.has(canonicalIngredientKey(line.ingredientKey)) ||
    meatKeys.has(line.ingredientKey));

/** Dishes that are as good the next day, and better in company: a stew, a bake, a pan of rice.
 *  A fried egg or a salad is not one of them, and offering leftovers of those is how an app
 *  loses a household's trust. */
const reheats = new Set(['soup', 'bake', 'pan', 'rice', 'pasta', 'potato', 'festive']);
export const reheatsWell = (meal: Pick<Meal, 'id' | 'name' | 'ingredients'>): boolean =>
  reheats.has(mealFamily(meal));

/** What one ingredient is left over after a set of chosen meals: whole packs bought, minus what
 *  the meals use. Nothing left and nothing bought both read as zero. */
export function openAmount(key: string, usedGrams: number): number {
  const canonical = ingredientPacks[key] !== undefined ? key : canonicalIngredientKey(key);
  const pack = ingredientPacks[canonical];
  if (!pack || usedGrams <= 0) return 0;
  return Math.ceil(usedGrams / pack) * pack - usedGrams;
}
/** How much of each ingredient the chosen meals use, by ingredient key. */
export function usedAmounts(items: MealChoice[]): Map<string, number> {
  const used = new Map<string, number>();
  for (const item of items) {
    if (!item.meal?.ingredients) continue;
    const share = item.servings / Math.max(1, item.meal.servings);
    for (const line of item.meal.ingredients) {
      const key = line.ingredientKey;
      used.set(key, (used.get(key) ?? 0) + line.quantity * share);
    }
  }
  return used;
}
/** What is left of every pack the plan already forces the household to buy, with the last day it
 *  was cooked with, so a dish that would use it up can be put close enough to still be fresh. */
export interface OpenPacks { amount: Map<string, number>; lastUsed: Map<string, string> }
export function openPacks(plan: Pick<WeekPlan, 'items'>): OpenPacks {
  const used = usedAmounts(plan.items);
  const amount = new Map<string, number>();
  for (const [key, grams] of used) {
    const left = openAmount(key, grams);
    if (left > 0) amount.set(key, left);
  }
  const lastUsed = new Map<string, string>();
  for (const item of plan.items) {
    const date = (item as { date?: string }).date;
    if (!date || !item.meal?.ingredients) continue;
    for (const line of item.meal.ingredients) {
      const known = lastUsed.get(line.ingredientKey);
      if (!known || date > known) lastUsed.set(line.ingredientKey, date);
    }
  }
  return { amount, lastUsed };
}
const dayGap = (from: string, to: string): number =>
  Math.abs(Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000;
/** How many grams of already-open packs this dish would use up on this day.
 *
 *  Only what is still good counts: a leftover is worth planning again while it keeps, and a
 *  pantry item is worth planning any day of the week. The gain is capped by what is open, so a
 *  dish is never credited for more than the household actually has in the fridge. */
export function leftoverUse(meal: Pick<Meal, 'ingredients' | 'servings'>, servings: number,
  date: string, open: OpenPacks): number {
  const share = servings / Math.max(1, meal.servings);
  let grams = 0;
  for (const line of meal.ingredients) {
    const left = open.amount.get(line.ingredientKey);
    if (!left) continue;
    const last = open.lastUsed.get(line.ingredientKey);
    if (last && dayGap(last, date) > keepsDays(line.ingredientKey)) continue;
    grams += Math.min(left, line.quantity * share);
  }
  return grams;
}
/** What the whole plan leaves over, in grams: the honest number under a week plan.
 *
 *  Both figures are given, because they are not the same thing. Half a bag of rice is not waste,
 *  it is next week's dinner; half a bag of spinach is the bin. Only the second number is worth
 *  worrying about, and only that one is worth planning against. */
export function plannedLeftovers(items: MealChoice[]): { total: number; fresh: number } {
  let total = 0, fresh = 0;
  for (const [key, used] of usedAmounts(items)) {
    const left = openAmount(key, used);
    total += left;
    if (perishable(key)) fresh += left;
  }
  return { total: Math.round(total), fresh: Math.round(fresh) };
}
/** Days of the plan on which nothing with meat or fish is cooked. */
export function meatFreeDays(plan: Pick<WeekPlan, 'days' | 'items'>): number {
  return plan.days.filter(day => {
    const onDay = plan.items.filter(item => item.date === day.date);
    return onDay.length > 0 && !onDay.some(item => item.meal && hasMeat(item.meal));
  }).length;
}
export const redMeatDishes = (items: MealChoice[]): number =>
  items.filter(item => item.meal && hasRedMeat(item.meal)).length;
/** Days on which the same dish is planned twice in a row: one pot, two dinners. The plan says
 *  so plainly, because somebody standing in the kitchen on Tuesday needs to know that Wednesday
 *  is already cooked. */
export function cookTwicePairs(plan: Pick<WeekPlan, 'items'>): { name: string; dates: [string, string] }[] {
  const pairs: { name: string; dates: [string, string] }[] = [];
  const sorted = [...plan.items].sort((a, b) => a.date.localeCompare(b.date));
  for (const item of sorted) {
    const next = sorted.find(other => other.meal?.id === item.meal?.id && other.id !== item.id &&
      dayGap(item.date, other.date) === 1 && other.date > item.date);
    if (next && !pairs.some(pair => pair.dates[1] === item.date && pair.name === item.meal.name)) {
      pairs.push({ name: item.meal.name, dates: [item.date, next.date] });
    }
  }
  return pairs;
}
