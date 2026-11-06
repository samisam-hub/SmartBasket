import { formatMoney, t } from '../services/i18n';
import { canonicalIngredientKey, ingredientMappings } from '../data/ingredient-mappings';
import type { ProductCategory } from '../types/product';
import type { BasketGenerationResult, SavedBasket } from '../types/basket';
import type { CustomItem } from './basket/custom-items';
import { formatQuantity, type UnitSystem } from './units';
import { ingredientCost, packCost } from './pricing/ingredientCost';

/** Which list the shopping tab opens on.
 *
 *  The one still being shopped wins, because that is what somebody standing in a shop wants to see.
 *  Otherwise the newest one. A list that was already bought is only shown when there is nothing
 *  else: it is a receipt by then, not a list. */
export function openingList(baskets: SavedBasket[], active: SavedBasket | null): SavedBasket | null {
  const known = baskets.filter(basket => typeof basket?.createdAt === 'string');
  // The remembered one counts only while it is still in the saved lists; a deleted one is gone.
  if (active && known.some(basket => basket.id === active.id) && !active.result.purchasedAt) return active;
  const newest = (list: SavedBasket[]) =>
    [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null;
  return newest(known.filter(basket => !basket.result.purchasedAt)) ?? newest(known);
}
/** What the tab calls the list. A shopping list and its basket are the same thing, so it carries
 *  the same name rather than inventing a second one that can drift from it. */
export const listName = (basket: SavedBasket | null): string => basket?.name.trim() || t('list.name');

/** A list built from the fictional merchant catalogue is a demonstration, not somebody's
 *  shopping. It stays out of the tab unless the merchant demo is deliberately on. */
export const fromDemoCatalogue = (basket: SavedBasket): boolean =>
  basket.result.items.some(item => item.product.source === 'demo');
/** One line of the shopping list: a thing to buy, how much of it, and what it costs about.
 *
 *  The estimate is the sum over the packages the engine picked for this ingredient, so it is a
 *  usual supermarket price rather than an offer from one shop — enough to keep a weekly budget
 *  honest without naming a product. */
export interface ShoppingLine {
  key: string;
  name: string;
  amount: number;
  unit: 'g' | 'ml';
  category: ProductCategory;
  /** What the amount on this line costs, by the kilo. */
  estimate: number | null;
  /** What buying it costs in whole packages, which is what the till asks for. */
  purchase: { packs: number; amount: number; cost: number } | null;
}
/** What the whole list costs about, and whether anything in it carries no price at all. */
export function listEstimate(lines: ShoppingLine[], extras: number = 0):
  { total: number; complete: boolean } {
  const priced = lines.filter(line => line.estimate !== null);
  return { total: Math.round(priced.reduce((sum, line) => sum + (line.estimate ?? 0), 0) * 100) / 100,
    complete: priced.length === lines.length && !extras };
}
/** What the shop will charge: every line in whole packages. Higher than what the meals use up,
 *  because nobody sells 64 g of parsley, and that difference is the point of showing it. */
export function listPurchase(lines: ShoppingLine[], extras: number = 0):
  { total: number; complete: boolean } {
  const priced = lines.filter(line => line.purchase !== null);
  return { total: Math.round(priced.reduce((sum, line) => sum + (line.purchase?.cost ?? 0), 0) * 100) / 100,
    complete: priced.length === lines.length && !extras };
}
/** What the week needs, as ingredients rather than packages.
 *
 *  The aggregated requirements are what the plan actually asks for — "500 g tomatoes" is the truth,
 *  while "2 tins" was always an assumption about package sizes. Baskets saved by the older engine
 *  carry no requirements, so those fall back to the packages they were built from rather than
 *  showing an empty list. */
export function shoppingLines(result: BasketGenerationResult): ShoppingLine[] {
  const category = (ingredientKey: string): ProductCategory =>
    ingredientMappings[canonicalIngredientKey(ingredientKey)]?.allowedCategories[0] ?? 'other';
  if (result.ingredientRequirements?.length)
    return result.ingredientRequirements
      .filter(line => Number.isFinite(line.requiredQuantity) && line.requiredQuantity > 0)
      .map(line => ({ key: line.ingredientKey, name: line.ingredientName,
        amount: line.requiredQuantity, unit: line.unit, category: category(line.ingredientKey),
        estimate: ingredientCost(line.ingredientKey, line.requiredQuantity),
        purchase: packCost(line.ingredientKey, line.requiredQuantity) }));
  return result.items.map(item => ({
    key: item.ingredientKey ?? item.product.id,
    name: item.product.name,
    amount: item.purchasedQuantity ?? item.packageCount * item.packageAmount,
    unit: item.quantityUnit,
    category: item.ingredientKey ? category(item.ingredientKey) : item.product.category ?? 'other',
    estimate: item.ingredientKey
      ? ingredientCost(item.ingredientKey, item.purchasedQuantity ?? item.packageCount * item.packageAmount)
      : item.estimatedPrice,
    purchase: item.ingredientKey
      ? packCost(item.ingredientKey, item.purchasedQuantity ?? item.packageCount * item.packageAmount)
      : null,
  }));
}
/** The same line with an amount somebody corrected by hand, priced again for that amount. */
export function withAmount(line: ShoppingLine, amount: number): ShoppingLine {
  return { ...line, amount, estimate: ingredientCost(line.key, amount), purchase: packCost(line.key, amount) };
}
/** Grouped the way a shop is walked, in the catalog's own category order. "Other" is a category
 *  of that list like any other and already sits last in it, so anything unrecognised lands there
 *  rather than being dropped or given a group of its own. */
export const shelves = ['produce', 'meat_fish', 'dairy_eggs', 'bread', 'pantry', 'drinks', 'other'] as const;
export type Shelf = (typeof shelves)[number];
/** The aisles of a shop, not the drawers of a database. Fifteen headings for sixteen lines is a
 *  table of contents, not a list: fruit and vegetables are picked up in one corner, meat and fish
 *  at one counter, and everything dry and keepable is the pantry. */
const shelfOf: Record<ProductCategory, Shelf> = {
  fruit: 'produce', vegetables: 'produce', potatoes: 'produce',
  meat: 'meat_fish', fish: 'meat_fish',
  dairy: 'dairy_eggs', 'dairy-alternatives': 'dairy_eggs', eggs: 'dairy_eggs',
  bread: 'bread',
  grains: 'pantry', pasta: 'pantry', legumes: 'pantry', breakfast: 'pantry', snacks: 'pantry',
  beverages: 'drinks',
  other: 'other',
};
/** Oil, vinegar, spices and the like are filed as "other" in the catalogue because they fit no
 *  food group, but in a shop they are the pantry shelf, next to the flour. */
const pantryIngredients = new Set(['olive_oil', 'pepper', 'cinnamon', 'curry_powder', 'paprika_powder',
  'italian_herbs', 'broth', 'mustard', 'vinegar', 'teriyaki', 'coconut_milk', 'honey', 'jam',
  'breadcrumbs', 'dark_chocolate']);
export function groupedLines(lines: ShoppingLine[]): { key: Shelf; label: string; lines: ShoppingLine[] }[] {
  const groups = new Map<Shelf, ShoppingLine[]>();
  for (const line of lines) {
    const shelf = pantryIngredients.has(canonicalIngredientKey(line.key)) ? 'pantry'
      : shelfOf[line.category] ?? 'other';
    const group = groups.get(shelf) ?? [];
    if (!group.length) groups.set(shelf, group);
    group.push(line);
  }
  return shelves.filter(key => groups.has(key))
    .map(key => ({ key, label: t(`shelf.${key}`), lines: groups.get(key)! }));
}

/** The whole list as one piece of text, for the share sheet.
 *
 *  Generated lines and the household's own additions go out together, in the order they are shown,
 *  because that is the list somebody is holding. What is already in the trolley is marked rather
 *  than dropped, so a shared list stays comparable with the one it came from. */
export function shoppingListText({ name, groups, extras, ticked, system }: {
  name: string;
  groups: { label: string; lines: ShoppingLine[] }[];
  extras: CustomItem[];
  ticked: string[];
  system: UnitSystem;
}): string {
  const done = new Set(ticked);
  const mark = (key: string, text: string) => `${done.has(key) ? '[x]' : '[ ]'} ${text}`;
  const blocks = groups
    .filter(group => group.lines.length)
    .map(group => [group.label.toUpperCase(),
      ...group.lines.map(line => mark(line.key, `${line.name} — ${formatQuantity(line, system)}`))].join('\n'));
  // The estimate travels with the list: whoever shops knows what to expect at the till.
  const estimate = listPurchase(groups.flatMap(group => group.lines), extras.length);
  if (extras.length)
    blocks.push([t('list.addedByYou').toUpperCase(),
      ...extras.map(item => mark(item.id, item.note ? `${item.name} — ${item.note}` : item.name))].join('\n'));
  blocks.push(t(estimate.complete ? 'list.estimate' : 'list.estimateFrom',
    { price: formatMoney(estimate.total) }));
  return [name, '', ...blocks].join('\n\n').trimEnd();
}
