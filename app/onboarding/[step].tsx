import { slotLabel, t, term, unitSystemLabel } from '@/services/i18n';
import { useCallback, useEffect, useRef, useState } from "react";
import { BackHandler, Text, View } from "react-native";
import type { NavigationProp } from "@react-navigation/native";
import {
  Redirect,
  router,
  useFocusEffect,
  useLocalSearchParams,
  useNavigation,
} from "expo-router";
import {
  EmptyState,
  ErrorMessage,
  InfoCard,
  PrimaryButton,
  ProgressIndicator,
  Screen,
  ScreenHeader,
  SectionCard,
  SelectionChip,
  TextButton,
} from "@/components/ui";
import { NumberInput } from "@/components/NumberInput";
import { HouseholdFields } from "@/components/HouseholdFields";
import { unitSystemOf, unitSystems } from "@/services/units";
import { PreferenceSummary } from "@/components/PreferenceSummary";
import { usePreferences } from "@/context/PreferencesContext";
import { useProfile } from "@/context/ProfileContext";
import {
  householdValues,
  toggleDiet,
  validatePreferences,
} from "@/services/preference-domain";
import { newParticipant, patchParticipant } from "@/services/profile-domain";
import type { PlanParticipant } from "@/types/profile";
import { mealSlots } from "@/types/meal";
import {
  allergens,
  diets,
  goals,
  slotDefaultsOf,
  steps,
  type OnboardingStep,
  type PreferenceErrors,
} from "@/types/preferences";
import { ui } from "@/lib/theme";
import {
  preferenceExitState,
  planningEntryState,
  type PreferenceIntent,
  type RootStackParams,
} from "@/services/preference-navigation";

const copy: Record<OnboardingStep, { title: string; subtitle: string }> = {
  welcome: {
    title: t('step.welcome.title'),
    subtitle:
      t('step.welcome.subtitle'),
  },
  household: {
    title: t('step.household.title'),
    subtitle:
      t('step.household.subtitle'),
  },
  meals: {
    title: t('step.meals.title'),
    subtitle:
      t('step.meals.subtitle'),
  },
  goals: {
    title: t('step.goals.title'),
    subtitle:
      t('step.goals.subtitle'),
  },
  diet: {
    title: t('step.diet.title'),
    subtitle:
      t('step.diet.subtitle'),
  },
  allergies: {
    title: t('step.allergies.title'),
    subtitle: t('step.allergies.subtitle'),
  },
  budget: {
    title: t('step.budget.title'),
    subtitle:
      t('step.budget.subtitle'),
  },
  review: {
    title: t('step.review.title'),
    subtitle:
      t('step.review.subtitle'),
  },
};
const fields: Record<OnboardingStep, (keyof PreferenceErrors)[]> = {
  welcome: [],
  household: ["participants", "householdSize", "dailyCalories"],
  meals: ["slotDefaults"],
  goals: ["primaryGoal", "proteinMode", "proteinTargetGrams"],
  diet: ["dietaryPreferences"],
  allergies: ["allergens"],
  budget: ["budgetEnabled", "weeklyBudgetEur"],
  review: [],
};
function go(step: OnboardingStep, intent: PreferenceIntent, review = false) {
  router.replace({
    pathname: "/onboarding/[step]",
    params: { step, intent, ...(review ? { review: "1" } : {}) },
  });
}
export default function OnboardingScreen() {
  const params = useLocalSearchParams<{
    step: string;
    review?: string;
    intent?: string;
  }>();
  const navigation = useNavigation<NavigationProp<RootStackParams>>(); // Direct child of the root Stack.
  const intent: PreferenceIntent = params.intent === "edit" ? "edit" : "onboarding";
  const exit = useCallback(
    () => navigation.reset(preferenceExitState(intent)),
    [navigation, intent],
  );
  const active = useRef(false);
  const pending = useRef(false);
  const [exiting, setExiting] = useState(false);
  const step = steps.includes(params.step as OnboardingStep)
    ? (params.step as OnboardingStep)
    : null;
  const returning = params.review === "1";
  const { draft, ready, saving, configured, localError, store } =
    usePreferences();
  const profile = useProfile();
  const [attempted, setAttempted] = useState(false);
  const busy = saving || exiting;
  const index = step ? steps.indexOf(step) : 0;
  const setPeople = useCallback(
    (people: PlanParticipant[]) =>
      store.update(
        people.length
          ? { participants: people, ...householdValues(people) }
          : { participants: undefined },
      ),
    [store],
  );
  // The person holding the phone is the first participant; personal defaults prefill them.
  useEffect(() => {
    if (!ready || draft.participants?.length || !profile.ready) return;
    const you: PlanParticipant = {
      ...newParticipant("adult", "current-user", "Du", draft.primaryGoal),
      isCurrentUser: true,
    };
    const saved = profile.saved;
    setPeople([
      saved
        ? patchParticipant(
            you,
            {
              name: saved.displayName.trim() || "Du",
              age: saved.age,
              sex: saved.sex,
              activityLevel: saved.activityLevel,
              ...(saved.defaultDailyCalories !== null
                ? { dailyCalories: saved.defaultDailyCalories }
                : {}),
            },
            draft.primaryGoal,
          )
        : you,
    ]);
  }, [
    ready,
    draft.participants,
    draft.primaryGoal,
    profile.ready,
    profile.saved,
    setPeople,
  ]);
  useEffect(() => {
    if (step && ready) store.goTo(step);
    setAttempted(false);
  }, [step, ready, store]);
  const back = useCallback(() => {
    if (busy || pending.current) return;
    if (returning) go("review", intent);
    else if (index > 0) go(steps[index - 1], intent);
    else exit();
  }, [busy, returning, index, intent, exit]);
  useFocusEffect(
    useCallback(() => {
      active.current = true;
      return () => { active.current = false; };
    }, []),
  );
  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener(
        "hardwareBackPress",
        () => {
          back();
          return true;
        },
      );
      return () => subscription.remove();
    }, [back]),
  );
  if (!step) return <Redirect href="/" />;
  if (!ready)
    return (
      <Screen bottom>
        <EmptyState
          title={t('step.preparing')}
          description={t('step.loadingProgress')}
          icon="loader"
        />
      </Screen>
    );
  const errors = validatePreferences(draft);
  const visible = attempted ? errors : {};
  const next = () => {
    if (busy || pending.current) return;
    setAttempted(true);
    if (fields[step].some((field) => errors[field])) return;
    if (returning) go("review", intent);
    else go(steps[index + 1], intent);
  };
  const finish = async (persist: () => Promise<boolean>, startPlanning = false) => {
    if (busy || pending.current) return;
    pending.current = true;
    setExiting(true);
    try {
      if ((await persist()) && active.current) {
        if (startPlanning) navigation.reset(planningEntryState());
        else exit();
      }
    } finally {
      pending.current = false;
      if (active.current) setExiting(false);
    }
  };
  const save = async () => {
    setAttempted(true);
    if (Object.keys(errors).length) return;
    await finish(store.save, intent === 'onboarding');
  };
  return (
    <Screen bottom>
      <View style={[ui.row, { justifyContent: "space-between" }]}>
        <TextButton label={t('step.back')} disabled={busy} onPress={back} />
        <TextButton
          label={t('step.saveAndClose')}
          disabled={busy}
          onPress={() => {
            void finish(store.flushDraft);
          }}
        />
      </View>
      <ProgressIndicator current={index + 1} total={steps.length} />
      <ScreenHeader {...copy[step]} />
      <ErrorMessage message={localError} />
      <View pointerEvents={busy ? "none" : "auto"} style={ui.stack}>
        {step === "welcome" && (
          <>
            <SectionCard title={t('step.units')}>
              <View style={ui.wrap}>
                {unitSystems.map((system) => (
                  <SelectionChip
                    key={system}
                    label={unitSystemLabel(system)}
                    selected={unitSystemOf(draft) === system}
                    onPress={() => store.update({ unitSystem: system })}
                  />
                ))}
              </View>
              <Text style={ui.small}>
                {t('step.unitsNote')}
              </Text>
            </SectionCard>
            <InfoCard title={t('step.goodStart')}>

              {t('step.goodStartBody')}
            </InfoCard>
            {!configured && (
              <InfoCard title={t('step.tryOnDevice')}>

                {t('step.tryOnDeviceBody')}
              </InfoCard>
            )}
          </>
        )}
        {step === "household" && (
          <>
            <HouseholdFields
              people={draft.participants ?? []}
              goal={draft.primaryGoal}
              onChange={setPeople}
            />
            <ErrorMessage
              message={
                visible.participants ??
                visible.householdSize ??
                visible.dailyCalories
              }
            />
          </>
        )}
        {step === "meals" && (
          <SectionCard>
            <View style={ui.wrap}>
              {mealSlots.map((slot) => (
                <SelectionChip
                  key={slot}
                  label={slotLabel(slot)}
                  selected={slotDefaultsOf(draft)[slot]}
                  onPress={() =>
                    store.update({
                      slotDefaults: {
                        ...slotDefaultsOf(draft),
                        [slot]: !slotDefaultsOf(draft)[slot],
                      },
                    })
                  }
                />
              ))}
            </View>
            <Text style={ui.small}>{t('step.mealsNote')}</Text>
            <ErrorMessage message={visible.slotDefaults} />
          </SectionCard>
        )}
        {step === "goals" && (
          <>
            <SectionCard>
              <Text style={ui.small}>
                {draft.participants?.length
                  ? t('step.caloriesSuggestion', { calories: draft.dailyCalories ?? '—' })
                  : t('step.householdNeeded')}
              </Text>
              <Text style={ui.subheading}>{t('step.mainGoal')}</Text>
              <View style={ui.wrap}>
                {goals.map((primaryGoal) => (
                  <SelectionChip
                    key={primaryGoal}
                    label={term(primaryGoal)}
                    selected={draft.primaryGoal === primaryGoal}
                    onPress={() => store.update({ primaryGoal })}
                  />
                ))}
              </View>
            </SectionCard>
            <SectionCard title={t('step.proteinTarget')}>
              <View style={ui.wrap}>
                {(["automatic", "manual"] as const).map((proteinMode) => (
                  <SelectionChip
                    key={proteinMode}
                    label={
                      proteinMode === "automatic"
                        ? "Automatisch"
                        : t('step.ownGrams')
                    }
                    selected={draft.proteinMode === proteinMode}
                    onPress={() =>
                      store.update({
                        proteinMode,
                        proteinTargetGrams:
                          proteinMode === "manual"
                            ? (draft.proteinTargetGrams ?? 100)
                            : null,
                      })
                    }
                  />
                ))}
              </View>
              {draft.proteinMode === "manual" ? (
                <NumberInput
                  label={t('step.proteinField')}
                  value={draft.proteinTargetGrams}
                  onChange={(proteinTargetGrams) =>
                    store.update({ proteinTargetGrams })
                  }
                  error={visible.proteinTargetGrams}
                />
              ) : (
                <Text style={ui.small}>{t('step.autoProtein')}</Text>
              )}
            </SectionCard>
          </>
        )}
        {step === "diet" && (
          <SectionCard>
            <View style={ui.wrap}>
              {diets.map((diet) => (
                <SelectionChip
                  key={diet}
                  label={term(diet)}
                  selected={draft.dietaryPreferences.includes(diet)}
                  onPress={() =>
                    store.update({
                      dietaryPreferences: toggleDiet(
                        draft.dietaryPreferences,
                        diet,
                      ),
                    })
                  }
                />
              ))}
            </View>
            <Text style={ui.small}>{t('step.dietNote')}</Text>
            <ErrorMessage message={visible.dietaryPreferences} />
          </SectionCard>
        )}
        {step === "diet" && draft.dietaryPreferences.includes("diabetes") && (
          <InfoCard title={t('step.diabetesTitle')}>{t('step.diabetesBody')}</InfoCard>
        )}
        {step === "allergies" && (
          <>
            <SectionCard>
              <View style={ui.wrap}>
                <SelectionChip
                  label={t('step.none')}
                  selected={!draft.allergens.length}
                  onPress={() => store.update({ allergens: [] })}
                />
                {allergens.map((allergen) => (
                  <SelectionChip
                    key={allergen}
                    label={term(allergen)}
                    selected={draft.allergens.includes(allergen)}
                    onPress={() =>
                      store.update({
                        allergens: draft.allergens.includes(allergen)
                          ? draft.allergens.filter((a) => a !== allergen)
                          : [...draft.allergens, allergen],
                      })
                    }
                  />
                ))}
              </View>
              <ErrorMessage message={visible.allergens} />
            </SectionCard>
            <InfoCard title={t('step.packagingTitle')}>{t('step.packagingBody')}</InfoCard>
          </>
        )}
        {step === "budget" && (
          <SectionCard>
            <View style={ui.wrap}>
              <SelectionChip
                label={t('step.noBudget')}
                selected={!draft.budgetEnabled}
                onPress={() =>
                  store.update({ budgetEnabled: false, weeklyBudgetEur: null })
                }
              />
              <SelectionChip
                label={t('step.budgetField')}
                selected={draft.budgetEnabled}
                onPress={() =>
                  store.update({
                    budgetEnabled: true,
                    weeklyBudgetEur: draft.weeklyBudgetEur ?? 70,
                  })
                }
              />
            </View>
            {draft.budgetEnabled && (
              <NumberInput
                decimal
                label={t('step.budgetForDays', { days: draft.planningDays })}
                value={draft.weeklyBudgetEur}
                onChange={(weeklyBudgetEur) =>
                  store.update({ weeklyBudgetEur })
                }
                error={visible.weeklyBudgetEur}
              />
            )}
            <Text style={ui.small}>{t('step.pricesEstimates')}</Text>
          </SectionCard>
        )}
        {step === "review" && (
          <>
            <SectionCard>
              <PreferenceSummary
                preferences={draft}
                onEdit={(target) => go(target, intent, true)}
              />
            </SectionCard>
            {attempted &&
              Object.entries(errors).map(([key, message]) => (
                <ErrorMessage key={key} message={message} />
              ))}
            <Text style={ui.small}>
              {configured
                ? t('step.cloudNote')
                : t('step.noCloud')}
            </Text>
          </>
        )}
      </View>
      {step === "review" ? (
        <PrimaryButton
          label={busy ? t('step.saving') : intent === "edit"
            ? t('step.saveChanges') : t('step.saveSettings')}
          loading={busy}
          onPress={() => {
            void save();
          }}
        />
      ) : (
        <PrimaryButton
          label={
            step === "welcome"
              ? "Loslegen"
              : returning
                ? t('step.backToOverview')
                : t('step.next')
          }
          onPress={next}
          disabled={busy}
        />
      )}
    </Screen>
  );
}
