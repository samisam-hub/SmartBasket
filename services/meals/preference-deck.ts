import { meals } from '../../data/meals';
import { compatibleMeal } from './planner';
import type { Meal } from '../../types/meal';
import type { PreferenceDraft } from '../../types/preferences';

/** The meals somebody is shown when saying what they like.
 *
 *  Only meals the household could actually eat: a card for something an allergy rules out is a
 *  question nobody should be asked. The order is stable, so leaving and coming back does not
 *  reshuffle the deck under them, and breakfasts, mains and snacks alternate rather than arriving
 *  in three blocks. */
export function preferenceDeck(preferences: PreferenceDraft, limit = 12): Meal[] {
  const usable = meals.filter(meal => compatibleMeal(meal, preferences));
  const byType = (type: Meal['mealType']) => usable.filter(meal => meal.mealType === type);
  const lanes = [byType('breakfast'), [...byType('lunch'), ...byType('dinner')], byType('snack')];
  const deck: Meal[] = [];
  for (let index = 0; deck.length < limit && lanes.some(lane => lane[index]); index++)
    for (const lane of lanes) if (lane[index] && deck.length < limit) deck.push(lane[index]);
  return deck;
}
/** Liking nothing is an answer too: it means no meal is pushed up the ranking, not that the
 *  household eats nothing. The planner reads an empty list exactly that way. */
export const likedMeals = (liked: string[]): string[] => [...new Set(liked)].filter(Boolean);
