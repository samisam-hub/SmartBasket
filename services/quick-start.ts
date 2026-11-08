import { defaultDraft, type PreferenceDraft, type UserPreferences } from '../types/preferences';

/** The household a tester is dropped into when nobody wants to answer eight questions in a shop:
 *  two people, a full week, the standard meals and the default budget. Every value here is a
 *  starting point, not an answer — the household screen and the preferences change all of it. */
export const sampleHousehold: Partial<PreferenceDraft> = {
  householdSize: 2,
  dailyCalories: defaultDraft.dailyCalories,
  planningDays: defaultDraft.planningDays,
};
export type QuickStartResult = 'ready' | 'started' | 'busy' | 'failed';
/** The slice of the preference store a quick start touches. */
export interface QuickStartStore {
  getSnapshot(): { ready: boolean; saving: boolean; saved: UserPreferences | null };
  update(patch: Partial<PreferenceDraft>): void;
  save(): Promise<boolean>;
}
/** Skip onboarding into a usable plan.
 *
 *  It never overwrites answers that are already given: opening the link a second time, or tapping
 *  the button after a real setup, leaves the household and its week exactly where they were. That
 *  matters most in the one place this exists for — a tester who reopens the link mid-shop. */
export async function quickStart(store: QuickStartStore): Promise<QuickStartResult> {
  const state = store.getSnapshot();
  if (!state.ready || state.saving) return 'busy';
  if (state.saved?.onboardingCompleted) return 'ready';
  store.update(sampleHousehold);
  return (await store.save()) ? 'started' : 'failed';
}
