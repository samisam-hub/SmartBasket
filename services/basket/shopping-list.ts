import type { BasketGenerationResult } from '../../types/basket';

export interface ShoppingRow {
  id: string;
  signature: string;
  name: string;
  quantity: string;
  missing: boolean;
}
const amount = (n: number) => n.toLocaleString('en-GB', { maximumFractionDigits: 1 });
const row = (id: string, name: string, quantity: string, missing = false): ShoppingRow =>
  ({ id, name, quantity, missing, signature: JSON.stringify([name, quantity, missing]) });

/** Show actual packages to buy, plus uncovered ingredients. Pantry quantities are not bought twice. */
export function shoppingRows(result: BasketGenerationResult): ShoppingRow[] {
  const products = result.items.map(item => row(`product:${item.product.id}`,
    `${item.product.name}${item.product.brand ? ` · ${item.product.brand}` : ''}`,
    `${item.packageCount} × ${amount(item.packageAmount)} ${item.quantityUnit}${item.quantityAssumed ? ' (estimated pack size)' : ''}`));
  const missing = (result.ingredientRequirements ?? []).flatMap(requirement => {
    const bought = result.items.filter(item => item.ingredientKey === requirement.ingredientKey)
      .reduce((sum, item) => sum + (item.plannedConsumptionQuantity ?? 0), 0);
    const pantry = (result.pantryUsed ?? []).filter(use => use.ingredientKey === requirement.ingredientKey)
      .reduce((sum, use) => sum + use.quantity, 0);
    if (bought + pantry >= requirement.minimumAcceptableQuantity - .001) return [];
    const needed = Math.max(0, requirement.requiredQuantity - bought - pantry);
    return [row(`ingredient:${requirement.ingredientKey}`, requirement.ingredientName,
      `${amount(needed)} ${requirement.unit} still needed`, true)];
  });
  return [...products, ...missing];
}

export const rowChecked = (row: ShoppingRow, checked: Record<string, string>): boolean =>
  checked[row.id] === row.signature;

/** No account, allergy or nutrition data is included in the shared shopping text. */
export function shoppingListText(name: string, rows: ShoppingRow[], checked: Record<string, string>): string {
  const line = (row: ShoppingRow) => `${rowChecked(row, checked) ? '[x]' : '[ ]'} ${row.name.replace(/[\r\n]+/g, ' ')} — ${row.quantity}${row.missing ? ' (choose a suitable product)' : ''}`;
  return [`SmartBasket · ${name.replace(/[\r\n]+/g, ' ')}`, '',
    ...rows.filter(row => !rowChecked(row, checked)).map(line),
    ...(rows.some(row => rowChecked(row, checked)) ? ['', 'Already picked up:', ...rows.filter(row => rowChecked(row, checked)).map(line)] : []),
  ].join('\n');
}
