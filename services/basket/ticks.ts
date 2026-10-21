import type { BasketStorage } from './persistence';

/** What is already in the trolley. It belongs to the shopping trip, not to the basket itself: no
 *  plan, price or nutrition figure depends on it, and clearing it loses nothing but the ticks. */
const key = (list: string) => `smartbasket.basket-ticks.v1:${list}`;

export async function loadTicks(storage: BasketStorage, list: string): Promise<string[]> {
  const raw = await storage.getItem(key(list));
  if (!raw) return [];
  try {
    const value: unknown = JSON.parse(raw);
    // A tick list that cannot be read is dropped, never repaired into something half true.
    if (!Array.isArray(value) || !value.every(id => typeof id === 'string')) return [];
    return [...new Set(value as string[])];
  } catch {
    return [];
  }
}
export function saveTicks(storage: BasketStorage, list: string, ticked: Iterable<string>): Promise<void> {
  return storage.setItem(key(list), JSON.stringify([...new Set(ticked)]));
}
/** Ticks for products that are no longer in the basket are dropped, so a replaced product never
 *  leaves a tick behind on the one that took its place. */
export const keptTicks = (ticked: Iterable<string>, present: Iterable<string>): string[] => {
  const inBasket = new Set(present);
  return [...new Set(ticked)].filter(id => inBasket.has(id));
};
