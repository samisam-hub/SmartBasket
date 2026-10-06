import type { SupabaseClient } from '@supabase/supabase-js';
import type { MealSlot } from '../../types/meal';

export const choiceActions = ['chosen', 'shuffled', 'skipped', 'heat_and_eat', 'ready_to_eat', 'eat_out', 'copied_day'] as const;
export type ChoiceAction = (typeof choiceActions)[number];
export interface MealChoiceEvent {
  planDate: string;
  mealSlot: MealSlot;
  /** The meals on screen when the decision was made. */
  shownMealIds: string[];
  action: ChoiceAction;
  chosenMealId?: string;
  /** How often "show two others" was pressed before deciding. */
  round: number;
}
export function choiceEventRow(event: MealChoiceEvent, userId: string) {
  return {
    user_id: userId, plan_date: event.planDate, meal_slot: event.mealSlot,
    shown_meal_ids: event.shownMealIds.slice(0, 8),
    action: event.action, chosen_meal_id: event.action === 'chosen' ? event.chosenMealId ?? null : null,
    round: Math.max(0, Math.min(50, Math.round(event.round))),
  };
}
/** Records a decision without ever standing in the way of it: planning does not depend on this,
 *  so a failed or impossible write is dropped rather than retried or surfaced. Nothing reads the
 *  rows yet; they exist so later suggestions can learn from real choices. */
export async function recordChoice(client: SupabaseClient | null, userId: string | null, event: MealChoiceEvent): Promise<void> {
  if (!client || !userId) return;
  try {
    await client.from('meal_choice_events').insert(choiceEventRow(event, userId));
  } catch {
    // Dropped on purpose: a decision the household already made must not fail over a log row.
  }
}
