import type { BasketStorage } from './persistence';

/** Something the household wants that no meal asked for: kitchen roll, coffee, a birthday cake.
 *
 *  These live beside the generated list, never inside it. The generated part is the engine's
 *  output and is validated as such on load; a hand-typed line in there would either break that
 *  check or force an invented product. Kept per list, like the ticks. */
export interface CustomItem { id: string; name: string; note: string | null }
const key = (list: string) => `smartbasket.list-extras.v1:${list}`;
export const customItemError = (name: string): string | null => {
  const trimmed = name.trim();
  if (!trimmed) return 'Type what you want to add.';
  return trimmed.length <= 80 ? null : 'Keep it to 80 characters.';
};
const valid = (value: unknown): value is CustomItem => {
  const item = value as CustomItem;
  return !!item && typeof item === 'object' && typeof item.id === 'string' && item.id.length > 0 &&
    typeof item.name === 'string' && !customItemError(item.name) &&
    (item.note === null || (typeof item.note === 'string' && item.note.length <= 40));
};
export async function loadCustomItems(storage: BasketStorage, list: string): Promise<CustomItem[]> {
  const raw = await storage.getItem(key(list));
  if (!raw) return [];
  try {
    const value: unknown = JSON.parse(raw);
    // A list that cannot be read is dropped rather than half restored.
    return Array.isArray(value) && value.every(valid) ? (value as CustomItem[]) : [];
  } catch {
    return [];
  }
}
export const saveCustomItems = (storage: BasketStorage, list: string, items: CustomItem[]): Promise<void> =>
  storage.setItem(key(list), JSON.stringify(items.filter(valid)));
/** Added at the end, where it was typed, so the list keeps the order the household built it in. */
export function addCustomItem(items: CustomItem[], name: string, note?: string): CustomItem[] {
  const problem = customItemError(name);
  if (problem) throw Error(problem);
  const trimmedNote = note?.trim() ?? '';
  return [...items, { id: `extra-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: name.trim(), note: trimmedNote ? trimmedNote.slice(0, 40) : null }];
}
export const removeCustomItem = (items: CustomItem[], id: string): CustomItem[] =>
  items.filter(item => item.id !== id);
