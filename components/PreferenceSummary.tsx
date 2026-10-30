import { t, term } from '../services/i18n';
import { View } from "react-native";
import { PreferenceRow } from "./ui";
import {
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
        label={t('summary.plannedMeals')}
        value={activeSlotLabels(p).join(", ")}
        onEdit={edit("meals")}
      />
      <PreferenceRow
        label={t('summary.caloriesPerPerson')}
        value={`${p.dailyCalories ?? t('summary.notSet')} kcal/Tag`}
        onEdit={edit("household")}
      />
      <PreferenceRow
        label={t('summary.goal')}
        value={term(p.primaryGoal)}
        onEdit={edit("goals")}
      />
      <PreferenceRow
        label={t('summary.proteinPerPerson')}
        value={
          p.proteinMode === "automatic"
            ? "Automatisch"
            : `${p.proteinTargetGrams ?? t('summary.notSet')} g/Tag`
        }
        onEdit={edit("goals")}
      />
      <PreferenceRow
        label={t('summary.diet')}
        value={p.dietaryPreferences.map((d) => term(d)).join(", ")}
        onEdit={edit("diet")}
      />
      <PreferenceRow
        label={t('summary.allergies')}
        value={p.allergens.map((a) => term(a)).join(", ") || "Keine ausgewählt"}
        onEdit={edit("allergies")}
      />
      <PreferenceRow
        label={`Gesamtbudget für ${p.planningDays} Tage`}
        value={
          p.budgetEnabled
            ? `€${p.weeklyBudgetEur ?? t('summary.notSet')}`
            : t('summary.noBudget')
        }
        onEdit={edit("budget")}
      />
    </View>
  );
}
