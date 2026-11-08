import { kindLabel, t, term } from '../services/i18n';
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
        label={t('summary.household')}
        value={
          p.participants?.length
            ? p.participants
                .map(
                  (person) =>
                    t('summary.personLine', { name: person.name || t('household.person'), kind: kindLabel(participantKind(person)), calories: person.dailyCalories ?? '—' }),
                )
                .join(", ")
            : t('summary.people', { count: p.householdSize })
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
        value={t('summary.caloriesPerDay', { calories: p.dailyCalories ?? t('summary.notSet') })}
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
            : t('summary.gramsPerDay', { grams: p.proteinTargetGrams ?? t('summary.notSet') })
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
        value={p.allergens.map((a) => term(a)).join(", ") || t('summary.noneSelected')}
        onEdit={edit("allergies")}
      />
      <PreferenceRow
        label={t('summary.budgetForDays', { days: p.planningDays })}
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
