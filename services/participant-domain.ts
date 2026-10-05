import { sexes, type PlanParticipant } from '../types/profile';
import { allergens, diets, defaultSlotDefaults, type PreferenceDraft } from '../types/preferences';

const inRange = (n: unknown, min: number, max: number, integer = false): n is number =>
  typeof n === 'number' && Number.isFinite(n) && n >= min && n <= max && (!integer || Number.isInteger(n));
const optional = (n: unknown, min: number, max: number, integer = false) =>
  n == null || inRange(n, min, max, integer);

/** Adult Mifflin–St Jeor only with complete measurements. Never infer missing measurements.
 * Children use a smaller, editable planning portion, not the adult equation. */
export function estimateCalories(p: PlanParticipant): number {
  if (p.kind === 'child') return 1400;
  if (!inRange(p.age, 18, 120, true) || !inRange(p.heightCm, 100, 250) ||
      !inRange(p.weightKg, 30, 500) || !['male', 'female'].includes(p.sex ?? '')) return 2000;
  const basal = 10 * p.weightKg + 6.25 * p.heightCm - 5 * p.age + (p.sex === 'male' ? 5 : -161);
  const factor = p.activityLevel === 'sedentary' ? 1.2 : p.activityLevel === 'active' ? 1.725 : 1.55;
  return Math.max(1000, Math.min(5000, Math.round(basal * factor)));
}

export function isParticipant(p: PlanParticipant): boolean {
  return !!p && typeof p.id === 'string' && p.id.length > 0 && p.id.length <= 100 &&
    typeof p.name === 'string' && p.name.trim().length > 0 && p.name.length <= 80 &&
    optional(p.age, 1, 120, true) && (p.sex === null || sexes.includes(p.sex)) &&
    (p.kind === undefined || p.kind === 'adult' || p.kind === 'child') &&
    (p.age === null || p.kind === undefined || (p.kind === 'child' ? p.age < 18 : p.age >= 18)) &&
    (p.activityLevel == null || ['sedentary', 'normal', 'active'].includes(p.activityLevel)) &&
    optional(p.heightCm, 50, 250) && optional(p.weightKg, 10, 500) &&
    (p.calorieTargetMode === undefined || ['recommended', 'manual'].includes(p.calorieTargetMode)) &&
    inRange(p.dailyCalories, 1000, 5000, true) && inRange(p.proteinTarget, 1, 500, true) &&
    Array.isArray(p.dietaryPreferences) && p.dietaryPreferences.length > 0 && p.dietaryPreferences.every(x => diets.includes(x)) &&
    Array.isArray(p.allergens) && p.allergens.every(x => allergens.includes(x)) &&
    Array.isArray(p.intolerances) && p.intolerances.every(x => ['lactose', 'gluten'].includes(x)) && typeof p.isCurrentUser === 'boolean';
}

export function updateParticipant(p: PlanParticipant, patch: Partial<PlanParticipant>): PlanParticipant {
  const next = { ...p, ...patch };
  if (next.calorieTargetMode === 'recommended') {
    next.dailyCalories = estimateCalories(next);
    next.proteinTarget = Math.round(next.dailyCalories * 0.2 / 4);
  }
  return next;
}

export function newParticipant(id: string, name: string, isCurrentUser = false): PlanParticipant {
  return { id, name, isCurrentUser, kind: null, age: null, sex: null, activityLevel: null,
    heightCm: null, weightKg: null, dailyCalories: 2000, proteinTarget: 100,
    calorieTargetMode: 'recommended', dietaryPreferences: ['none'], allergens: [], intolerances: [] };
}

/** Editing a legacy household creates people without modifying its saved plan snapshots. */
export function onboardingHousehold(draft: PreferenceDraft): Partial<PreferenceDraft> {
  const participants = draft.participants ?? Array.from({ length: draft.householdSize }, (_, index) => ({
    ...newParticipant(index === 0 ? 'current-user' : `person-${index + 1}`, index === 0 ? 'You' : `Person ${index + 1}`, index === 0),
    dailyCalories: draft.dailyCalories ?? 2000,
    proteinTarget: draft.proteinMode === 'manual' ? draft.proteinTargetGrams ?? 100 : Math.round((draft.dailyCalories ?? 2000) * .2 / 4),
    dietaryPreferences: [...draft.dietaryPreferences], allergens: [...draft.allergens],
  }));
  return { participants, slotDefaults: draft.slotDefaults ?? { ...defaultSlotDefaults } };
}

export function householdPatch(participants: PlanParticipant[]): Partial<PreferenceDraft> {
  return { participants, householdSize: participants.length, proteinMode: 'automatic', proteinTargetGrams: null,
    dailyCalories: Math.round(participants.reduce((sum, p) => sum + (p.dailyCalories ?? 0), 0) / participants.length) };
}
