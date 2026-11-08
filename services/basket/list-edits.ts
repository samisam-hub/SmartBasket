import type { BasketStorage } from './persistence';

/** What a household did to a generated list before taking it shopping.
 *
 *  A new list is a proposal: it is read through once, lines that are already in the cupboard are
 *  taken out, amounts are corrected, missing things are added. Saving it ends that pass, and from
 *  then on the list is for shopping — compact, tickable, shareable. Both facts live here rather
 *  than in the plan, for the same reason corrected amounts do: the engine's output is validated
 *  as it was produced, and a household's decision is not the engine's. */
export interface ListEdits {
  /** True once somebody has been through the list and saved it. */
  saved: boolean;
  /** Keys of generated lines taken out: already at home, or simply not wanted. */
  removed: string[];
}
export const noEdits: ListEdits = { saved: false, removed: [] };
const key = (list: string) => `smartbasket.list-edits.v1:${list}`;
const isKey = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && value.length <= 200;

export async function loadListEdits(storage: BasketStorage, list: string): Promise<ListEdits> {
  const raw = await storage.getItem(key(list));
  if (!raw) return noEdits;
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== 'object' || Array.isArray(value)) return noEdits;
    const record = value as { saved?: unknown; removed?: unknown };
    // One unreadable entry costs that line's removal, not the whole state of the list.
    return { saved: record.saved === true,
      removed: Array.isArray(record.removed) ? record.removed.filter(isKey).slice(0, 500) : [] };
  } catch {
    return noEdits;
  }
}
export const saveListEdits = (storage: BasketStorage, list: string, edits: ListEdits): Promise<void> =>
  storage.setItem(key(list), JSON.stringify(edits));
/** A line taken out of the list. Taking out the same line twice changes nothing. */
export const withoutLine = (edits: ListEdits, lineKey: string): ListEdits =>
  edits.removed.includes(lineKey) ? edits : { ...edits, removed: [...edits.removed, lineKey] };
/** The undo behind the "removed" message: the line comes back where it was. */
export const withLine = (edits: ListEdits, lineKey: string): ListEdits =>
  ({ ...edits, removed: edits.removed.filter(key => key !== lineKey) });
