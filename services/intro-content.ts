import type { IntroArtKind } from '../components/IntroArt';
import { t, type TranslationKey } from './i18n';

/** What the app says about itself before it asks for anything.
 *
 *  Three pages: what it does, what it watches out for, and how the week runs. Kept apart from the
 *  screen so the promises can be checked without rendering anything — a claim about allergies is
 *  not a layout detail. Each page is a short line plus a list, because three promises read faster
 *  as three lines than as one paragraph. */
export interface IntroPage {
  kind: IntroArtKind;
  title: string;
  body?: string;
  /** Ticked where the list is a set of promises, numbered where it is an order of steps. */
  points?: { marker: 'check' | 'number'; items: string[] };
  aside?: string;
}
interface PageSource {
  kind: IntroArtKind;
  title: TranslationKey;
  body?: TranslationKey;
  points?: { marker: 'check' | 'number'; items: TranslationKey[] };
  aside?: TranslationKey;
}
const pages: PageSource[] = [
  { kind: 'plan', title: 'intro.1.title', body: 'intro.1.body' },
  {
    kind: 'goals',
    title: 'intro.2.title',
    points: { marker: 'check', items: ['intro.2.goal', 'intro.2.budget', 'intro.2.allergies'] },
    aside: 'intro.2.aside',
  },
  {
    kind: 'calendar',
    title: 'intro.3.title',
    points: { marker: 'number', items: ['intro.3.step1', 'intro.3.step2', 'intro.3.step3'] },
  },
];
export const introPages = (): IntroPage[] => pages.map(page => ({
  kind: page.kind,
  title: t(page.title),
  ...(page.body ? { body: t(page.body) } : {}),
  ...(page.points ? { points: { marker: page.points.marker, items: page.points.items.map(key => t(key)) } } : {}),
  ...(page.aside ? { aside: t(page.aside) } : {}),
}));
