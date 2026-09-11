import type { UserPreferences } from '../../types/preferences';
import type { PlanParticipant } from '../../types/profile';
import { participantPreferences } from '../profile-domain';
import { validatePreferences } from '../preference-domain';
import { clarification, isVoicePlan, type VoicePlan } from './contract';
import { meals } from '../../data/meals';
import { compatibleMeal } from '../meals/planner';

export function voiceDefaults(people: PlanParticipant[], base: UserPreferences): VoicePlan {
  return { days: null, budgetEnabled: base.budgetEnabled, budget: base.weeklyBudgetEur,
    people: people.map(p => ({ name: p.name, calories: p.dailyCalories, protein: p.proteinTarget,
      diets: p.dietaryPreferences, allergens: p.allergens })), preferredMealIds: [] };
}
// The agent can add restrictions, but cannot silently remove existing ones.
export function voiceParticipants(plan: VoicePlan, originals: PlanParticipant[]): PlanParticipant[] {
  return plan.people.map((p, i) => {
    const original = originals[i];
    const diets = new Set([...p.diets, ...(original?.dietaryPreferences ?? [])]);
    if (diets.size > 1) diets.delete('none');
    const strict = (['vegan', 'vegetarian', 'pescatarian'] as const).find(d => diets.has(d));
    for (const d of ['vegan', 'vegetarian', 'pescatarian'] as const) if (d !== strict) diets.delete(d);
    return { id: original?.id ?? `voice-person-${i}`, name: p.name.trim(), age: original?.age ?? null, sex: original?.sex ?? null,
      isCurrentUser: original?.isCurrentUser ?? false, dailyCalories: p.calories, proteinTarget: p.protein,
      dietaryPreferences: [...diets], allergens: [...new Set([...p.allergens, ...(original?.allergens ?? [])])], intolerances: original?.intolerances ?? [] };
  });
}
export function confirmedVoicePlan(plan: VoicePlan, base: UserPreferences, originals: PlanParticipant[]): UserPreferences {
  if (!isVoicePlan(plan) || clarification(plan, 'en')) throw Error('Please finish the planning questions first.');
  if (plan.preferredMealIds.some(id => !meals.some(m => m.id === id))) throw Error('A requested meal is unavailable. Please review your wishes.');
  const result = participantPreferences({ ...base, planningDays: plan.days!, budgetEnabled: plan.budgetEnabled!,
    weeklyBudgetEur: plan.budgetEnabled ? plan.budget : null, preferredMealIds: plan.preferredMealIds }, voiceParticipants(plan, originals));
  const errors = validatePreferences(result);
  if (Object.keys(errors).length) throw Error(Object.values(errors).join(' '));
  if (plan.preferredMealIds.some(id => !meals.some(m => m.id === id && compatibleMeal(m, result)))) throw Error('A requested meal conflicts with your dietary settings. Please choose another meal.');
  return result;
}
