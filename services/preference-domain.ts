import {
  allergens,
  diets,
  goals,
  labels,
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
    errors.householdSize = "Choose between 1 and 10 people.";
  if (value.participants !== undefined) {
    if (!validParticipantList(value.participants))
      errors.participants =
        "Every person needs a name and a calorie suggestion from 1,000 to 5,000 kcal.";
    else if (value.participants.length !== value.householdSize)
      errors.householdSize = "The household size must match the people you added.";
  }
  if (value.slotDefaults !== undefined && !validSlotDefaults(value.slotDefaults))
    errors.slotDefaults = "Choose at least one meal you plan for.";
  if (![3, 5, 7, 14].includes(value.planningDays))
    errors.planningDays = "Choose 3, 5, 7, or 14 days.";
  if (!integerIn(value.dailyCalories, 1000, 5000))
    errors.dailyCalories = "Enter a whole number from 1,000 to 5,000 kcal.";
  if (!goals.includes(value.primaryGoal))
    errors.primaryGoal = "Choose one nutrition goal.";
  if (!["automatic", "manual"].includes(value.proteinMode))
    errors.proteinMode = "Choose automatic or manual protein.";
  if (
    value.proteinMode === "manual" &&
    !integerIn(value.proteinTargetGrams, 1, 500)
  )
    errors.proteinTargetGrams = "Enter a whole number from 1 to 500 g per day.";
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
    errors.dietaryPreferences = "Choose compatible dietary preferences.";
  if (
    !Array.isArray(value.allergens) ||
    value.allergens.some((a) => !allergens.includes(a)) ||
    new Set(value.allergens).size !== value.allergens.length
  )
    errors.allergens = "Choose allergens from the list, or None.";
  if (typeof value.budgetEnabled !== "boolean")
    errors.budgetEnabled = "Choose a budget option.";
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
      "Enter €0.01–€10,000, with at most two decimal places.";
  return errors;
}
export function normalizedValues(draft: PreferenceDraft): PreferenceValues {
  if (Object.keys(validatePreferences(draft)).length)
    throw new Error("Please check the highlighted preferences.");
  return {
    ...draft,
    dailyCalories: draft.dailyCalories as number,
    proteinTargetGrams:
      draft.proteinMode === "manual" ? draft.proteinTargetGrams : null,
    weeklyBudgetEur: draft.budgetEnabled ? draft.weeklyBudgetEur : null,
  };
}
export const slotLabels: Record<(typeof mealSlots)[number], string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snack",
};
export const activeSlotLabels = (p: { slotDefaults?: SlotDefaults }): string[] =>
  mealSlots.filter((slot) => slotDefaultsOf(p)[slot]).map((slot) => slotLabels[slot]);
export function preferenceChips(p: UserPreferences): string[] {
  return [
    `${p.planningDays} days`,
    `${p.householdSize} ${p.householdSize === 1 ? "person" : "people"}`,
    `${activeSlotLabels(p).join(", ")}`,
    `${p.dailyCalories.toLocaleString("en-GB")} kcal`,
    labels[p.primaryGoal],
    ...p.dietaryPreferences.filter((d) => d !== "none").map((d) => labels[d]),
    p.budgetEnabled ? `€${p.weeklyBudgetEur} budget` : "No budget limit",
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
    (p.slotDefaults === undefined || validSlotDefaults(p.slotDefaults))
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
