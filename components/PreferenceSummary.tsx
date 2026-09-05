import { View } from "react-native";
import { PreferenceRow } from "./ui";
import {
  labels,
  type OnboardingStep,
  type PreferenceDraft,
} from "@/types/preferences";
import { ui } from "@/lib/theme";
export function PreferenceSummary({
  preferences: p,
  onEdit,
}: {
  preferences: PreferenceDraft;
  onEdit?: (step: OnboardingStep) => void;
}) {
  const edit = (step: OnboardingStep) =>
    onEdit ? () => onEdit(step) : undefined;
  return (
    <View style={ui.stack}>
      <PreferenceRow
        label="Household"
        value={`${p.householdSize} ${p.householdSize === 1 ? "person" : "people"}`}
        onEdit={edit("household")}
      />
      <PreferenceRow
        label="Planning period"
        value={`${p.planningDays} days`}
        onEdit={edit("household")}
      />
      <PreferenceRow
        label="Calories per person"
        value={`${p.dailyCalories ?? "Not set"} kcal/day`}
        onEdit={edit("goals")}
      />
      <PreferenceRow
        label="Nutrition goal"
        value={labels[p.primaryGoal]}
        onEdit={edit("goals")}
      />
      <PreferenceRow
        label="Protein per person"
        value={
          p.proteinMode === "automatic"
            ? "Automatic"
            : `${p.proteinTargetGrams ?? "Not set"} g/day`
        }
        onEdit={edit("goals")}
      />
      <PreferenceRow
        label="Diet"
        value={p.dietaryPreferences.map((d) => labels[d]).join(", ")}
        onEdit={edit("diet")}
      />
      <PreferenceRow
        label="Allergies & intolerances"
        value={p.allergens.map((a) => labels[a]).join(", ") || "None selected"}
        onEdit={edit("allergies")}
      />
      <PreferenceRow
        label={`Total budget for ${p.planningDays} days`}
        value={
          p.budgetEnabled
            ? `€${p.weeklyBudgetEur ?? "Not set"}`
            : "No budget limit"
        }
        onEdit={edit("budget")}
      />
    </View>
  );
}
