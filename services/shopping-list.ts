import { categoryLabel, t } from '../services/i18n';
import { canonicalIngredientKey, ingredientMappings } from '../data/ingredient-mappings';
import { categories, type ProductCategory } from '../types/product';
import type { BasketGenerationResult, SavedBasket } from '../types/basket';
import type { CustomItem } from './basket/custom-items';
import { formatQuantity, type UnitSystem } from './units';

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

/** One line of the shopping list: a thing to buy and how much of it. */
export interface ShoppingLine {
  key: string;
  name: string;
  amount: number;
  unit: 'g' | 'ml';
  category: ProductCategory;
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
        amount: line.requiredQuantity, unit: line.unit, category: category(line.ingredientKey) }));
  return result.items.map(item => ({
    key: item.ingredientKey ?? item.product.id,
    name: item.product.name,
    amount: item.purchasedQuantity ?? item.packageCount * item.packageAmount,
    unit: item.quantityUnit,
    category: item.ingredientKey ? category(item.ingredientKey) : item.product.category ?? 'other',
  }));
}
/** Grouped the way a shop is walked, in the catalog's own category order. "Other" is a category
 *  of that list like any other and already sits last in it, so anything unrecognised lands there
 *  rather than being dropped or given a group of its own. */
export function groupedLines(lines: ShoppingLine[]): { key: ProductCategory; label: string; lines: ShoppingLine[] }[] {
  const groups = new Map<ProductCategory, ShoppingLine[]>();
  for (const line of lines) {
    const group = groups.get(line.category) ?? [];
    if (!group.length) groups.set(line.category, group);
    group.push(line);
  }
  return categories.filter(key => groups.has(key))
    .map(key => ({ key, label: categoryLabel(key), lines: groups.get(key)! }));
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
  if (extras.length)
    blocks.push([t('list.addedByYou').toUpperCase(),
      ...extras.map(item => mark(item.id, item.note ? `${item.name} — ${item.note}` : item.name))].join('\n'));
  return [name, '', ...blocks].join('\n\n').trimEnd();
}
