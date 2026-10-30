import type { IntroArtKind } from '../components/IntroArt';
import { t, type TranslationKey } from './i18n';

/** What the app says about itself before it asks for anything.
 *
 *  Three pages: what it does, what it watches out for, and how the week runs. Kept apart from the
 *  screen so the promises can be checked without rendering anything — a claim about allergies is
 *  not a layout detail. */
export interface IntroPage { kind: IntroArtKind; title: string; body: string; aside?: string }
/** The three pages, as keys. Read through `t` at display time, so the words follow the locale and
 *  the promises can still be checked without rendering anything. */
const pages: { kind: IntroArtKind; title: TranslationKey; body: TranslationKey; aside?: TranslationKey }[] = [
  { kind: 'plan', title: 'intro.1.title', body: 'intro.1.body' },
  { kind: 'goals', title: 'intro.2.title', body: 'intro.2.body', aside: 'intro.2.aside' },
  { kind: 'calendar', title: 'intro.3.title', body: 'intro.3.body' },
];
export const introPages = (): IntroPage[] => pages.map(page => ({
  kind: page.kind,
  title: t(page.title),
  body: t(page.body),
  ...(page.aside ? { aside: t(page.aside) } : {}),
}));
