import {
  allergens,
  diets,
  goals,
  labels,
  type Diet,
  type PreferenceDraft,
  type PreferenceErrors,
  type PreferenceValues,
  type UserPreferences,
} from "../types/preferences";

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
const integerIn = (value: unknown, min: number, max: number) =>
  typeof value === "number" &&
  Number.isInteger(value) &&
  value >= min &&
  value <= max;
export function validatePreferences(value: PreferenceDraft): PreferenceErrors {
  const errors: PreferenceErrors = {};
  if (!integerIn(value.householdSize, 1, 10))
    errors.householdSize = "Choose between 1 and 10 people.";
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
export function preferenceChips(p: UserPreferences): string[] {
  return [
    `${p.planningDays} days`,
    `${p.householdSize} ${p.householdSize === 1 ? "person" : "people"}`,
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
    (p.weeklyBudgetEur === null || typeof p.weeklyBudgetEur === "number")
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
