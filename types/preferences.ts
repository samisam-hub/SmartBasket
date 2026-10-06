import { mealSlots, type MealSlot } from "./meal";
export const goals = [
  "maintain",
  "lose_weight",
  "build_muscle",
  "high_protein",
  "balanced",
] as const;
export const diets = [
  "none",
  "vegetarian",
  "vegan",
  "pescatarian",
  "lactose_free",
  "gluten_free",
  "diabetes",
] as const;
export const allergens = [
  "milk",
  "eggs",
  "fish",
  "shellfish",
  "peanuts",
  "tree_nuts",
  "soy",
  "wheat",
  "sesame",
] as const;
export const steps = [
  "welcome",
  "household",
  "meals",
  "goals",
  "diet",
  "allergies",
  "budget",
  "review",
] as const;
export type Goal = (typeof goals)[number];
export type Diet = (typeof diets)[number];
export type Allergen = (typeof allergens)[number];
export type OnboardingStep = (typeof steps)[number];
/** Which meals the household plans by default; the calendar prefills every chosen day with these. */
export type SlotDefaults = Record<MealSlot, boolean>;
export const defaultSlotDefaults: SlotDefaults = {
  breakfast: true,
  lunch: true,
  dinner: true,
  snack: false,
};
/** Preferences saved before the meal standard existed fall back to the default. */
export const slotDefaultsOf = (p: { slotDefaults?: SlotDefaults }): SlotDefaults =>
  p.slotDefaults ?? defaultSlotDefaults;
export const activeSlots = (p: { slotDefaults?: SlotDefaults }): MealSlot[] =>
  mealSlots.filter((slot) => slotDefaultsOf(p)[slot]);
export interface PreferenceValues {
  /** Household as people, so each one can carry its own targets and restrictions.
   *  Absent in preferences saved before the calendar onboarding; householdSize still applies. */
  participants?: import("./profile").PlanParticipant[];
  /** Absent before the meal standard existed; slotDefaultsOf falls back to the default. */
  slotDefaults?: SlotDefaults;
  householdSize: number;
  planningDays: number;
  dailyCalories: number;
  primaryGoal: Goal;
  proteinMode: "automatic" | "manual";
  proteinTargetGrams: number | null;
  dietaryPreferences: Diet[];
  allergens: Allergen[];
  budgetEnabled: boolean;
  /** Total EUR for the selected planning period; legacy column name retained. */
  weeklyBudgetEur: number | null;
}
export type PreferenceDraft = Omit<PreferenceValues, "dailyCalories"> & {
  dailyCalories: number | null;
};
export interface UserPreferences extends PreferenceValues {
  preferredMealIds?: string[];
  id: string | null;
  userId: string | null;
  onboardingCompleted: boolean;
  createdAt: string;
  updatedAt: string;
}
export const labels: Record<Goal | Diet | Allergen, string> = {
  maintain: "Maintain",
  lose_weight: "Lose weight",
  build_muscle: "Build muscle",
  high_protein: "High protein",
  balanced: "Balanced nutrition",
  none: "No restriction",
  vegetarian: "Vegetarian",
  vegan: "Vegan",
  pescatarian: "Pescatarian",
  lactose_free: "Lactose-free",
  gluten_free: "Gluten-free",
  diabetes: "Diabetes-friendly",
  milk: "Milk",
  eggs: "Eggs",
  fish: "Fish",
  shellfish: "Shellfish",
  peanuts: "Peanuts",
  tree_nuts: "Tree nuts",
  soy: "Soy",
  wheat: "Wheat",
  sesame: "Sesame",
};
export const defaultDraft: PreferenceDraft = {
  householdSize: 1,
  planningDays: 7,
  dailyCalories: 2000,
  primaryGoal: "maintain",
  proteinMode: "automatic",
  proteinTargetGrams: null,
  dietaryPreferences: ["none"],
  allergens: [],
  budgetEnabled: true,
  weeklyBudgetEur: 70,
};
export type PreferenceErrors = Partial<Record<keyof PreferenceValues, string>>;
