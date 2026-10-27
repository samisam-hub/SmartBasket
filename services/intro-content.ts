import type { IntroArtKind } from '../components/IntroArt';

/** What the app says about itself before it asks for anything.
 *
 *  Three pages: what it does, what it watches out for, and how the week runs. Kept apart from the
 *  screen so the promises can be checked without rendering anything — a claim about allergies is
 *  not a layout detail. */
export interface IntroPage { kind: IntroArtKind; title: string; body: string; aside?: string }
export const introPages: IntroPage[] = [
  {
    kind: 'plan',
    title: 'Plan the week, shop it once',
    body: 'A simple app for planning what your household eats. Pick the meals, and the shopping list writes itself — every ingredient added up across the week, so you buy each thing once.',
  },
  {
    kind: 'goals',
    title: 'It watches three things for you',
    body: 'Your fitness goal, so portions match what each person needs. Your weekly budget, so the list stays inside it. And allergies and diets, which are never traded away for a better fit.',
    aside: 'Allergy information comes from the recipes we curate. Always check the label on what you buy.',
  },
  {
    kind: 'calendar',
    title: 'Four steps, then you shop',
    body: 'Set up who eats along. Swipe through meals to say what you like. Pick the days you want to cook for. Then create the list and take it to the shop.',
  },
];
