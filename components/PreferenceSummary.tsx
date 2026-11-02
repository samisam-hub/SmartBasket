import { View } from "react-native";
import { PreferenceRow } from "./ui";
import {
  labels,
  type OnboardingStep,
  type PreferenceDraft,
} from "@/types/preferences";
import { activeSlotLabels } from "@/services/preference-domain";
import { participantKind } from "@/services/profile-domain";
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
        label="Haushalt"
        value={
          p.participants?.length
            ? p.participants
                .map(
                  (person) =>
                    `${person.name || "Person"} (${participantKind(person) === "child" ? "Kind" : "Erwachsene Person"}, ${person.dailyCalories ?? "—"} kcal)`,
                )
                .join(", ")
            : `${p.householdSize} ${p.householdSize === 1 ? "Person" : "Personen"}`
        }
        onEdit={edit("household")}
      />
      <PreferenceRow
        label="Geplante Mahlzeiten"
        value={activeSlotLabels(p).join(", ")}
        onEdit={edit("meals")}
      />
      <PreferenceRow
        label="Kalorien pro Person"
        value={`${p.dailyCalories ?? "Nicht festgelegt"} kcal/Tag`}
        onEdit={edit("household")}
      />
      <PreferenceRow
        label="Ernährungsziel"
        value={labels[p.primaryGoal]}
        onEdit={edit("goals")}
      />
      <PreferenceRow
        label="Eiweiß pro Person"
        value={
          p.proteinMode === "automatic"
            ? "Automatisch"
            : `${p.proteinTargetGrams ?? "Nicht festgelegt"} g/Tag`
        }
        onEdit={edit("goals")}
      />
      <PreferenceRow
        label="Ernährungsweise"
        value={p.dietaryPreferences.map((d) => labels[d]).join(", ")}
        onEdit={edit("diet")}
      />
      <PreferenceRow
        label="Allergien und Unverträglichkeiten"
        value={p.allergens.map((a) => labels[a]).join(", ") || "Keine ausgewählt"}
        onEdit={edit("allergies")}
      />
      <PreferenceRow
        label={`Gesamtbudget für ${p.planningDays} Tage`}
        value={
          p.budgetEnabled
            ? `€${p.weeklyBudgetEur ?? "Nicht festgelegt"}`
            : "Kein Budgetlimit"
        }
        onEdit={edit("budget")}
      />
    </View>
  );
}
