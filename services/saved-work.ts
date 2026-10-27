import type { UserPreferences } from '../types/preferences';

/** Whether this identity can have anything saved at all.
 *
 *  Nothing is ever written before preferences are completed: a basket, a plan and a purchase all
 *  come out of that. So for a guest who has just opened the app there is nothing to fetch, and
 *  asking anyway costs a round trip and puts a "saved on this device" notice in front of somebody
 *  who has not saved anything yet. The honest answer for them is the empty state, straight away. */
export const hasSavedWork = (saved: UserPreferences | null | undefined): boolean =>
  saved?.onboardingCompleted === true;
