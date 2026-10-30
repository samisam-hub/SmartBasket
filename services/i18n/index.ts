import { de, type TranslationKey } from './de';
import { en } from './en';
import { isLocale, locales, type Locale, type Params, type Phrase } from './types';
export { isLocale, locales, type Locale };
export type { TranslationKey };

const dictionaries: Record<Locale, Partial<Record<TranslationKey, Phrase>>> = { de, en };
/** The tags a device reports, mapped to what we actually have. German for a German-speaking
 *  device, English for everybody else, because English is the wider of the two. */
export function localeFromTags(tags: readonly string[]): Locale {
  for (const tag of tags) {
    const language = tag.toLowerCase().split(/[-_]/)[0];
    if (language === 'de') return 'de';
    if (language === 'en') return 'en';
  }
  return 'en';
}
/** What the device is set to, as far as it can be asked without a native module. Hermes resolves
 *  Intl from the system locale; a runtime without Intl keeps the default. */
export function detectLocale(): Locale | null {
  try {
    const resolved = Intl.DateTimeFormat().resolvedOptions().locale;
    return resolved ? localeFromTags([resolved]) : null;
  } catch {
    return null;
  }
}

/** German until something says otherwise: the app was written in it, and a screen must never wait
 *  for a locale to load. The store lives at module level so services can translate too — an error
 *  thrown deep in a store is shown to somebody. */
let current: Locale = 'de';
let chosen = false;
const listeners = new Set<() => void>();
export const locale = (): Locale => current;
/** Whether the locale is the viewer's own choice rather than the device's. */
export const localeChosen = (): boolean => chosen;
export const subscribeLocale = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};
function publish(next: Locale, byChoice: boolean) {
  chosen = byChoice;
  if (next === current) return;
  current = next;
  for (const listener of [...listeners]) listener();
}
export const STORAGE_KEY = 'smartbasket.locale.v1';
export interface LocaleStorage { getItem: (key: string) => Promise<string | null>; setItem: (key: string, value: string) => Promise<void> }
/** Device first, the viewer's own choice over it. A storage that cannot be read is not an error
 *  worth showing: the app simply follows the device. */
export async function initLocale(storage?: LocaleStorage): Promise<Locale> {
  const device = detectLocale();
  if (device) publish(device, false);
  if (storage) {
    try {
      const stored = await storage.getItem(STORAGE_KEY);
      if (isLocale(stored)) publish(stored, true);
    } catch { /* keep the device locale */ }
  }
  return current;
}
/** Switching is immediate; remembering it must not be, so a failed write is reported and the
 *  screen still follows the choice for this run. */
export async function setLocale(next: Locale, storage?: LocaleStorage): Promise<void> {
  if (!isLocale(next)) throw Error('Unbekannte Sprache');
  publish(next, true);
  if (storage) await storage.setItem(STORAGE_KEY, next);
}
/** Test seam: the locale outlives a single test, the way it outlives a single screen. */
export function resetLocale(): void {
  current = 'de';
  chosen = false;
  listeners.clear();
}

const plural = (phrase: Phrase, params: Params | undefined): string => {
  if (typeof phrase === 'string') return phrase;
  const count = params?.count;
  if (typeof count !== 'number') throw Error(`A counted phrase needs a count: ${phrase.other}`);
  return new Intl.PluralRules(intlLocale()).select(count) === 'one' ? phrase.one : phrase.other;
};
const fill = (text: string, params: Params | undefined, key: string): string =>
  text.replace(/\{(\w+)\}/g, (_match, name: string) => {
    const value = params?.[name];
    if (value === undefined) throw Error(`Missing parameter {${name}} for ${key}`);
    return String(value);
  });
/** The translated phrase, with its counts and names filled in. A key the active locale has not
 *  translated falls back to German rather than showing the key to somebody. */
export function t(key: TranslationKey, params?: Params): string {
  const phrase = dictionaries[current][key] ?? de[key];
  return fill(plural(phrase, params), params, key);
}
/** A value the app stores, shown as a word: a goal, a diet, an allergen, a provenance code. Codes
 *  we do not know are shown as they are rather than hidden. */
export function term(value: string): string {
  const key = `term.${value}` as TranslationKey;
  return key in de ? t(key) : value;
}

export const intlLocale = (): string => (current === 'de' ? 'de-DE' : 'en-US');
export const formatNumber = (value: number, digits = 0) =>
  value.toLocaleString(intlLocale(), { maximumFractionDigits: digits });
export const formatDecimal = (value: number, digits = 2) =>
  value.toLocaleString(intlLocale(), { minimumFractionDigits: digits, maximumFractionDigits: digits });
/** Prices come from a German catalogue, so the currency stays the euro; only its shape follows
 *  the locale. */
export const formatMoney = (value: number) =>
  value.toLocaleString(intlLocale(), { style: 'currency', currency: 'EUR' });
export const formatDate = (value: Date | string) =>
  new Date(value).toLocaleDateString(intlLocale());
export const formatDateTime = (value: Date | string) =>
  new Date(value).toLocaleString(intlLocale());

/** Supabase reports a stable code; its English message is not shown verbatim. */
export function authError(error: { code?: string; message?: string }): Error {
  const key = `auth.${error.code ?? ''}` as TranslationKey;
  if (key in de) return new Error(t(key));
  const network = /network|failed to fetch|fetch failed/i.test(error.message ?? '');
  return new Error(t(network ? 'auth.network' : 'auth.unknown'));
}

/** Typed words for the enums the app stores. A new value in one of these unions is a type error
 *  here until it is translated, which is the point. */
export const slotLabel = (slot: import('../../types/meal').MealSlot) => t(`term.${slot}`);
export const categoryLabel = (category: import('../../types/product').ProductCategory) => t(`category.${category}`);
export const groupLabel = (group: import('../../types/basket').BasketGroup) => t(`group.${group}`);
export const kindLabel = (kind: import('../../types/profile').ParticipantKind) => t(`kind.${kind}`);
export const modeLabel = (mode: import('../../types/meal').MealMode) => t(`mode.${mode}`);
export const readyCategoryLabel = (category: import('../../types/meal').ReadyMealCategory) => t(`ready.${category}`);
export const dietaryFieldLabel = (field: import('../catalog/discovery').DietaryField) => t(`filter.${field}`);
export const unitSystemLabel = (system: import('../units').UnitSystem) => t(`units.${system}`);
