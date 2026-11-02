import type { WeekPlan } from '../../types/meal';
import type { UserPreferences } from '../../types/preferences';
import type { Product } from '../../types/product';
import type { MealRatings } from './taste';
import { attendingPeople, type AttendanceRule } from './attendance';
import { ingredientAvailability, suggestMeals } from './planner';
import { chooseMeal, setPresence, skipSlot } from './weekPlanDraft';
import { itemsInSlot } from './weekPlan';

/** Fill only undecided slots. Existing meals, separate dishes and explicit skips are preserved. */
export function fillWeek(plan: WeekPlan, preferences: UserPreferences, catalog: Product[],
  ratings: MealRatings, rules: AttendanceRule[]): WeekPlan {
  if (!plan.days.length) throw Error("Wähle mindestens einen Tag, bevor du einen Plan erstellst.");
  const availability = ingredientAvailability(catalog, preferences);
  let next = plan;
  for (const day of plan.days) for (const slot of day.slots) {
    if (itemsInSlot(next, day.date, slot).length) continue;
    const attending = attendingPeople(next, day.date, slot, rules);
    if (next.participants?.length && !attending.length) {
      next = skipSlot(next, day.date, slot, preferences);
      continue;
    }
    const suggestion = suggestMeals(next, day.date, slot, preferences, catalog, [], undefined, ratings, availability)[0];
    // An empty pool remains visibly open; dislikes never silently become meals.
    if (!suggestion) continue;
    next = chooseMeal(next, day.date, slot, suggestion, preferences);
    if (next.participants?.length && attending.length < next.participants.length) {
      next = setPresence(next, next.items[next.items.length - 1].id, attending, preferences);
    }
  }
  if (!next.days.length) throw Error("Bei den ausgewählten Mahlzeiten isst niemand zu Hause. Passe Tage oder Anwesenheit an.");
  return next;
}
