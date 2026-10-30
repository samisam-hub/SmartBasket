import { formatMoney, formatNumber, slotLabel, t, term } from './i18n';
import {
  allergens,
  diets,
  goals,
  slotDefaultsOf,
  type Diet,
  type PreferenceDraft,
  type PreferenceErrors,
  type PreferenceValues,
  type SlotDefaults,
  type UserPreferences,
} from "../types/preferences";
import { mealSlots } from "../types/meal";
import type { PlanParticipant } from "../types/profile";
import { isParticipant } from "./profile-domain";
import { isUnitSystem } from "./units";

export function toggleDiet(current: Diet[], selected: Diet): Diet[] {
  if (selected === "none") return ["none"];
  let next = current.filter((item) => item !== "none");
  if (next.includes(selected)) next = next.filter((item) => item !== selected);
  else {
    if (["vegetarian", "vegan", "pescatarian"].includes(selected))
      next = next.filter(
        (item) => !["vegetarian", "vegan", "pescatarian"].includes(item),
      );
    next.push(selected);
  }
  return next.length ? next : ["none"];
}
/** The household is a list of people; the saved size and per-person calories follow from it. */
export function householdValues(participants: PlanParticipant[]): Pick<PreferenceValues, "householdSize" | "dailyCalories"> {
  return {
    householdSize: participants.length,
    dailyCalories: Math.round(
      participants.reduce((sum, p) => sum + (p.dailyCalories ?? 0), 0) / participants.length,
    ),
  };
}
export function validParticipantList(value: unknown): value is PlanParticipant[] {
  if (!Array.isArray(value) || !value.length || value.length > 10) return false;
  return value.every(isParticipant) && new Set(value.map((p) => p.id)).size === value.length &&
    value.filter((p) => p.isCurrentUser).length <= 1;
}
export function validSlotDefaults(value: unknown): value is SlotDefaults {
  if (!value || typeof value !== "object") return false;
  const slots = value as Record<string, unknown>;
  return Object.keys(slots).length === mealSlots.length &&
    mealSlots.every((slot) => typeof slots[slot] === "boolean") &&
    mealSlots.some((slot) => slots[slot] === true);
}
const integerIn = (value: unknown, min: number, max: number) =>
  typeof value === "number" &&
  Number.isInteger(value) &&
  value >= min &&
  value <= max;
export function validatePreferences(value: PreferenceDraft): PreferenceErrors {
  const errors: PreferenceErrors = {};
  if (!integerIn(value.householdSize, 1, 10))
    errors.householdSize = t('valid.household');
  if (value.participants !== undefined) {
    if (!validParticipantList(value.participants))
      errors.participants =
        t('valid.participants');
    else if (value.participants.length !== value.householdSize)
      errors.householdSize = t('valid.householdSize');
  }
  if (value.slotDefaults !== undefined && !validSlotDefaults(value.slotDefaults))
    errors.slotDefaults = t('valid.oneSlot');
  if (![3, 5, 7, 14].includes(value.planningDays))
    errors.planningDays = t('valid.days');
  if (!integerIn(value.dailyCalories, 1000, 5000))
    errors.dailyCalories = t('valid.calories');
  if (!goals.includes(value.primaryGoal))
    errors.primaryGoal = t('valid.goal');
  if (!["automatic", "manual"].includes(value.proteinMode))
    errors.proteinMode = t('valid.proteinMode');
  if (
    value.proteinMode === "manual" &&
    !integerIn(value.proteinTargetGrams, 1, 500)
  )
    errors.proteinTargetGrams = t('valid.proteinGrams');
  if (
    !Array.isArray(value.dietaryPreferences) ||
    !value.dietaryPreferences.length ||
    value.dietaryPreferences.some((d) => !diets.includes(d)) ||
    new Set(value.dietaryPreferences).size !==
      value.dietaryPreferences.length ||
    (value.dietaryPreferences.includes("none") &&
      value.dietaryPreferences.length > 1) ||
    value.dietaryPreferences.filter((d) =>
      ["vegan", "vegetarian", "pescatarian"].includes(d),
    ).length > 1
  )
    errors.dietaryPreferences = t('valid.diets');
  if (
    !Array.isArray(value.allergens) ||
    value.allergens.some((a) => !allergens.includes(a)) ||
    new Set(value.allergens).size !== value.allergens.length
  )
    errors.allergens = t('valid.allergens');
  if (typeof value.budgetEnabled !== "boolean")
    errors.budgetEnabled = t('valid.budgetOption');
  if (
    value.budgetEnabled &&
    (typeof value.weeklyBudgetEur !== "number" ||
      !Number.isFinite(value.weeklyBudgetEur) ||
      value.weeklyBudgetEur <= 0 ||
      value.weeklyBudgetEur > 10000 ||
      Math.abs(
        value.weeklyBudgetEur * 100 - Math.round(value.weeklyBudgetEur * 100),
      ) > 0.00001)
  )
    errors.weeklyBudgetEur =
      t('valid.budgetAmount');
  return errors;
}
export function normalizedValues(draft: PreferenceDraft): PreferenceValues {
  if (Object.keys(validatePreferences(draft)).length)
    throw new Error(t('valid.checkMarked'));
  return {
    ...draft,
    dailyCalories: draft.dailyCalories as number,
    proteinTargetGrams:
      draft.proteinMode === "manual" ? draft.proteinTargetGrams : null,
    weeklyBudgetEur: draft.budgetEnabled ? draft.weeklyBudgetEur : null,
  };
}
export const activeSlotLabels = (p: { slotDefaults?: SlotDefaults }): string[] =>
  mealSlots.filter((slot) => slotDefaultsOf(p)[slot]).map((slot) => slotLabel(slot));
export function preferenceChips(p: UserPreferences): string[] {
  return [
    t('summary.daysPlanned', { count: p.planningDays }),
    t('summary.people', { count: p.householdSize }),
    `${activeSlotLabels(p).join(", ")}`,
    `${formatNumber(p.dailyCalories)} kcal`,
    term(p.primaryGoal),
    ...p.dietaryPreferences.filter((d) => d !== "none").map((d) => term(d)),
    p.budgetEnabled ? t('summary.budgetAmount', { amount: formatMoney(p.weeklyBudgetEur ?? 0) }) : t('summary.noBudget'),
  ];
}
/** Check persisted input without coercing malformed data into valid preferences. */
export function isDraft(value: unknown): value is PreferenceDraft {
  if (!value || typeof value !== "object") return false;
  const p = value as PreferenceDraft;
  return (
    typeof p.householdSize === "number" &&
    typeof p.planningDays === "number" &&
    (p.dailyCalories === null || typeof p.dailyCalories === "number") &&
    goals.includes(p.primaryGoal) &&
    ["automatic", "manual"].includes(p.proteinMode) &&
    (p.proteinTargetGrams === null ||
      typeof p.proteinTargetGrams === "number") &&
    Array.isArray(p.dietaryPreferences) &&
    p.dietaryPreferences.every((d) => diets.includes(d)) &&
    Array.isArray(p.allergens) &&
    p.allergens.every((a) => allergens.includes(a)) &&
    typeof p.budgetEnabled === "boolean" &&
    (p.weeklyBudgetEur === null || typeof p.weeklyBudgetEur === "number") &&
    (p.participants === undefined || validParticipantList(p.participants)) &&
    (p.slotDefaults === undefined || validSlotDefaults(p.slotDefaults)) &&
    // Absent means metric; anything else stored there is not a preference we can honour.
    (p.unitSystem === undefined || isUnitSystem(p.unitSystem)) &&
    (p.preferredMealIds === undefined ||
      (Array.isArray(p.preferredMealIds) && p.preferredMealIds.every(id => typeof id === 'string')))
  );
}
export function isSaved(value: unknown): value is UserPreferences {
  if (!isDraft(value) || Object.keys(validatePreferences(value)).length)
    return false;
  const p = value as UserPreferences;
  return (
    (p.id === null || typeof p.id === "string") &&
    (p.userId === null || typeof p.userId === "string") &&
    p.onboardingCompleted === true &&
    typeof p.createdAt === "string" &&
    typeof p.updatedAt === "string"
  );
}
