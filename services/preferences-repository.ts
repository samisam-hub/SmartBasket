import { getSupabaseClient } from "../lib/supabase";
import { isSaved } from "./preference-domain";
import type { RemotePreferences } from "./preference-store";
import type { UserPreferences } from "../types/preferences";

export interface PreferenceRow {
  id: string;
  user_id: string;
  household_size: number;
  planning_days: number;
  daily_calories: number;
  primary_goal: UserPreferences["primaryGoal"];
  protein_mode: UserPreferences["proteinMode"];
  protein_target_grams: number | null;
  dietary_preferences: UserPreferences["dietaryPreferences"];
  allergens: UserPreferences["allergens"];
  budget_enabled: boolean;
  weekly_budget_eur: number | null;
  onboarding_completed: boolean;
  created_at: string;
  updated_at: string;
}
export function fromRow(row: PreferenceRow): UserPreferences {
  const p = {
    id: row.id,
    userId: row.user_id,
    householdSize: row.household_size,
    planningDays: row.planning_days,
    dailyCalories: row.daily_calories,
    primaryGoal: row.primary_goal,
    proteinMode: row.protein_mode,
    proteinTargetGrams: row.protein_target_grams,
    dietaryPreferences: row.dietary_preferences,
    allergens: row.allergens,
    budgetEnabled: row.budget_enabled,
    weeklyBudgetEur: row.weekly_budget_eur,
    onboardingCompleted: row.onboarding_completed,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
  if (!isSaved(p)) throw new Error("Invalid cloud preferences");
  return p;
}
export function toRow(p: UserPreferences, userId: string) {
  return {
    user_id: userId,
    household_size: p.householdSize,
    planning_days: p.planningDays,
    daily_calories: p.dailyCalories,
    primary_goal: p.primaryGoal,
    protein_mode: p.proteinMode,
    protein_target_grams: p.proteinTargetGrams,
    dietary_preferences: p.dietaryPreferences,
    allergens: p.allergens,
    budget_enabled: p.budgetEnabled,
    weekly_budget_eur: p.weeklyBudgetEur,
    onboarding_completed: true,
  };
}
let identity: Promise<string> | null = null;
async function ensureIdentity(): Promise<string> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error("Supabase is not configured");
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  if (data.session) return data.session.user.id;
  const result = await supabase.auth.signInAnonymously();
  if (result.error) throw result.error;
  if (!result.data.user)
    throw new Error("Anonymous sign-in did not return a user");
  return result.data.user.id;
}
async function userId() {
  identity ??= ensureIdentity();
  try {
    return await identity;
  } finally {
    identity = null;
  }
}
export const remotePreferences: RemotePreferences = {
  async load() {
    const id = await userId();
    const { data, error } = await getSupabaseClient()!
      .from("user_preferences")
      .select("*")
      .eq("user_id", id)
      .maybeSingle();
    if (error) throw error;
    return data ? fromRow(data as PreferenceRow) : null;
  },
  async save(preferences) {
    const id = await userId();
    if (preferences.userId && preferences.userId !== id)
      throw new Error("These preferences belong to a different session.");
    const { data, error } = await getSupabaseClient()!
      .from("user_preferences")
      .upsert(toRow(preferences, id), { onConflict: "user_id" })
      .select("*")
      .single();
    if (error) throw error;
    return fromRow(data as PreferenceRow);
  },
};
