import type { BasketStorage } from './persistence';

/** An amount the household corrected by hand: "we need a kilo of potatoes, not 600 g".
 *
 *  Kept per list, beside the generated lines and the ticks, for the same reason the extras are:
 *  the engine's output is validated as it was produced, and a hand-typed number inside it would
 *  either break that check or quietly pass as the engine's own. The plan keeps what it planned;
 *  the shopping list shows what somebody decided to buy. */
export type LineAmounts = Record<string, number>;
const key = (list: string) => `smartbasket.list-amounts.v1:${list}`;
/** A shopping amount: positive, finite and short of a ton, which no household buys at once. */
export const validAmount = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0 && value <= 1_000_000;
export async function loadLineAmounts(storage: BasketStorage, list: string): Promise<LineAmounts> {
  const raw = await storage.getItem(key(list));
  if (!raw) return {};
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    // One unreadable entry drops that line's correction, not everybody else's.
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .filter((entry): entry is [string, number] => validAmount(entry[1])));
  } catch {
    return {};
  }
}
export const saveLineAmounts = (storage: BasketStorage, list: string, amounts: LineAmounts): Promise<void> =>
  storage.setItem(key(list), JSON.stringify(amounts));
/** Setting a line back to what the plan asked for removes the correction rather than storing it. */
export function withLineAmount(amounts: LineAmounts, lineKey: string, amount: number, planned: number): LineAmounts {
  const next = { ...amounts };
  if (!validAmount(amount) || Math.abs(amount - planned) < 0.5) delete next[lineKey];
  else next[lineKey] = Math.round(amount * 10) / 10;
  return next;
}
