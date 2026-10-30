export const locales = ['de', 'en'] as const;
export type Locale = (typeof locales)[number];
export const isLocale = (value: unknown): value is Locale =>
  typeof value === 'string' && (locales as readonly string[]).includes(value);
/** A phrase is one string, or the two forms a count needs. Intl.PluralRules picks between them,
 *  so a locale that needs other categories can add them without changing any call site. */
export type Phrase = string | { one: string; other: string };
export type Params = Record<string, string | number>;
