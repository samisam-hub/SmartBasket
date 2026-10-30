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
    errors.householdSize = "Wähle zwischen 1 und 10 Personen.";
  if (value.participants !== undefined) {
    if (!validParticipantList(value.participants))
      errors.participants =
        "Jede Person benötigt einen Namen und einen Kalorienwert von 1.000 bis 5.000 kcal.";
    else if (value.participants.length !== value.householdSize)
      errors.householdSize = "Die Haushaltsgröße muss zu den hinzugefügten Personen passen.";
  }
  if (value.slotDefaults !== undefined && !validSlotDefaults(value.slotDefaults))
    errors.slotDefaults = "Wähle mindestens eine Mahlzeit zum Planen.";
  if (![3, 5, 7, 14].includes(value.planningDays))
    errors.planningDays = "Wähle 3, 5, 7 oder 14 Tage.";
  if (!integerIn(value.dailyCalories, 1000, 5000))
    errors.dailyCalories = "Gib eine ganze Zahl von 1.000 bis 5.000 kcal ein.";
  if (!goals.includes(value.primaryGoal))
    errors.primaryGoal = "Wähle ein Ernährungsziel.";
  if (!["automatic", "manual"].includes(value.proteinMode))
    errors.proteinMode = "Wähle ein automatisches oder selbst festgelegtes Eiweißziel.";
  if (
    value.proteinMode === "manual" &&
    !integerIn(value.proteinTargetGrams, 1, 500)
  )
    errors.proteinTargetGrams = "Gib eine ganze Zahl von 1 bis 500 g pro Tag ein.";
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
    errors.dietaryPreferences = "Wähle miteinander vereinbare Ernährungseinstellungen.";
  if (
    !Array.isArray(value.allergens) ||
    value.allergens.some((a) => !allergens.includes(a)) ||
    new Set(value.allergens).size !== value.allergens.length
  )
    errors.allergens = "Wähle Allergene aus der Liste oder Keine.";
  if (typeof value.budgetEnabled !== "boolean")
    errors.budgetEnabled = "Wähle eine Budgetoption.";
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
      "Gib 0,01–10.000 € mit höchstens zwei Nachkommastellen ein.";
  return errors;
}
export function normalizedValues(draft: PreferenceDraft): PreferenceValues {
  if (Object.keys(validatePreferences(draft)).length)
    throw new Error("Prüfe die markierten Einstellungen.");
  return {
    ...draft,
    dailyCalories: draft.dailyCalories as number,
    proteinTargetGrams:
      draft.proteinMode === "manual" ? draft.proteinTargetGrams : null,
    weeklyBudgetEur: draft.budgetEnabled ? draft.weeklyBudgetEur : null,
  };
}
export const slotLabels: Record<(typeof mealSlots)[number], string> = {
  breakfast: "Frühstück",
  lunch: "Mittagessen",
  dinner: "Abendessen",
  snack: "Snack",
};
export const activeSlotLabels = (p: { slotDefaults?: SlotDefaults }): string[] =>
  mealSlots.filter((slot) => slotDefaultsOf(p)[slot]).map((slot) => slotLabels[slot]);
export function preferenceChips(p: UserPreferences): string[] {
  return [
    `${p.planningDays} Tage`,
    `${p.householdSize} ${p.householdSize === 1 ? "Person" : "Personen"}`,
    `${activeSlotLabels(p).join(", ")}`,
    `${p.dailyCalories.toLocaleString("de-DE")} kcal`,
    labels[p.primaryGoal],
    ...p.dietaryPreferences.filter((d) => d !== "none").map((d) => labels[d]),
    p.budgetEnabled ? `€${p.weeklyBudgetEur} Budget` : "Kein Budgetlimit",
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
