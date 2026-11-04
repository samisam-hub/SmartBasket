export const locales = ['de', 'en'] as const;
export type Locale = (typeof locales)[number];
export const isLocale = (value: unknown): value is Locale =>
  typeof value === 'string' && (locales as readonly string[]).includes(value);
/** A phrase is one string, or the two forms a count needs. German and English both put exactly
 *  one in the first form and everything else in the second; a locale with further categories
 *  would extend this type and the rule in t(). */
export type Phrase = string | { one: string; other: string };
export type Params = Record<string, string | number>;
