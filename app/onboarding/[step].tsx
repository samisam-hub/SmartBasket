import { slotLabel, term, unitSystemLabel } from '@/services/i18n';
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
    title: "Dein Einkauf, passend zu dir.",
    subtitle:
      "Ein paar Angaben zu Ernährung, Alltag und Budget. Dein Fortschritt wird auf diesem Gerät gespeichert.",
  },
  household: {
    title: "Für wen planen wir?",
    subtitle:
      "Füge Erwachsene und Kinder hinzu. Details kannst du jederzeit ergänzen. Die Tagesmenge ist ein Vorschlag, den du anpassen kannst.",
  },
  meals: {
    title: "Welche Mahlzeiten möchtest du planen?",
    subtitle:
      "Dein üblicher Tagesablauf. Der Kalender übernimmt diese Mahlzeiten für ausgewählte Tage. Einzelne Mahlzeiten kannst du pro Tag abwählen.",
  },
  goals: {
    title: "Essen, das zu deinen Zielen passt.",
    subtitle:
      "Dein Ziel beeinflusst den Eiweißanteil der vorgeschlagenen Mengen. Dies sind deine Einstellungen, keine individuelle Ernährungsvorgabe.",
  },
  diet: {
    title: "Essen, das zu deinem Alltag passt.",
    subtitle:
      "Wähle eine Ernährungsweise und zusätzliche Anforderungen, etwa diabetesbewusst. Du kannst sie später ändern.",
  },
  allergies: {
    title: "Was sollen wir berücksichtigen?",
    subtitle: "Wähle die Allergien und Unverträglichkeiten aus, die wir berücksichtigen sollen.",
  },
  budget: {
    title: "Wie hoch ist dein Einkaufsbudget?",
    subtitle:
      "Lege ein Gesamtbudget für den Haushalt und den gewählten Planungszeitraum fest.",
  },
  review: {
    title: "Deine Einstellungen auf einen Blick.",
    subtitle:
      "Prüfe deine Einstellungen vor dem Speichern. Über das Bearbeiten-Symbol kannst du jeden Bereich ändern.",
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
          title="Alles wird vorbereitet"
          description="Dein gespeicherter Fortschritt wird geladen …"
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
        <TextButton label="Zurück" disabled={busy} onPress={back} />
        <TextButton
          label="Speichern und schließen"
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
            <SectionCard title="In welchen Einheiten kaufst du ein?">
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
                Das ändert nur, wie deine Einkaufsliste geschrieben ist. Die Mengen werden exakt
                umgerechnet; am Plan selbst ändert sich nichts. Du kannst jederzeit wechseln.
              </Text>
            </SectionCard>
            <InfoCard title="Ein paar Angaben für einen guten Start.">

              Dein Kalorienziel, deine Essensvorlieben, dein Haushalt und dein Budget bestimmen künftige Warenkörbe. Ohne E-Mail oder Passwort.
            </InfoCard>
            {!configured && (
              <InfoCard title="Auf diesem Gerät ausprobieren">

                Die Cloud ist nicht eingerichtet. Deine Angaben und Einstellungen bleiben auf diesem Gerät.
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
            <Text style={ui.small}>

              Frühstück, Mittagessen und Abendessen sind vorausgewählt, ein Snack nicht. Jeder Kalendertag beginnt mit diesem Muster. Einzelne Mahlzeiten kannst du dort abwählen.
            </Text>
            <ErrorMessage message={visible.slotDefaults} />
          </SectionCard>
        )}
        {step === "goals" && (
          <>
            <SectionCard>
              <Text style={ui.small}>
                {draft.participants?.length
                  ? `Vorschlag für deinen Haushalt: etwa ${draft.dailyCalories ?? "—"} kcal pro Person und Tag. Im Bereich Haushalt kannst du den Wert pro Person ändern.`
                  : "Füge die Personen deines Haushalts hinzu, um eine vorgeschlagene Tagesmenge zu erhalten."}
              </Text>
              <Text style={ui.subheading}>Wichtigstes Ernährungsziel</Text>
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
            <SectionCard title="Eiweißziel">
              <View style={ui.wrap}>
                {(["automatic", "manual"] as const).map((proteinMode) => (
                  <SelectionChip
                    key={proteinMode}
                    label={
                      proteinMode === "automatic"
                        ? "Automatisch"
                        : "Gramm pro Tag selbst festlegen"
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
                  label="Eiweißziel (g/Tag)"
                  value={draft.proteinTargetGrams}
                  onChange={(proteinTargetGrams) =>
                    store.update({ proteinTargetGrams })
                  }
                  error={visible.proteinTargetGrams}
                />
              ) : (
                <Text style={ui.small}>

                  Kein eigener Zielwert. Das Eiweißziel wird bei der Warenkorberstellung automatisch berechnet.
                </Text>
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
            <Text style={ui.small}>

              Vegetarisch, vegan und pescetarisch sind unterschiedliche Ernährungsweisen. Laktosefrei, glutenfrei und diabetesbewusst lassen sich jeweils ergänzen.
            </Text>
            <ErrorMessage message={visible.dietaryPreferences} />
          </SectionCard>
        )}
        {step === "diet" && draft.dietaryPreferences.includes("diabetes") && (
          <InfoCard title="So filtert diabetesbewusst deinen Warenkorb">

            Wir berücksichtigen Produkte mit angegebenem Zucker unter der Schwelle für hohen Zuckergehalt (22,5 g je 100 g bzw. 11,25 g je 100 ml) und Mahlzeiten mit üblichen Kohlenhydratportionen. Produkte ohne Zuckerangabe werden ausgeschlossen. Dies ist eine Einkaufspräferenz, keine medizinische Beratung oder Behandlung. Prüfe Verpackungen und beachte die Empfehlungen deines Behandlungsteams.
          </InfoCard>
        )}
        {step === "allergies" && (
          <>
            <SectionCard>
              <View style={ui.wrap}>
                <SelectionChip
                  label="Keine"
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
            <InfoCard title="Prüfe immer die Verpackungsangaben">

              Diese Einstellungen garantieren nicht, dass ein Produkt bei einer Allergie geeignet ist. Prüfe Zutaten und Hinweise auf mögliche Spuren. Laktosefrei bedeutet nicht milchfrei.
            </InfoCard>
          </>
        )}
        {step === "budget" && (
          <SectionCard>
            <View style={ui.wrap}>
              <SelectionChip
                label="Kein Budgetlimit"
                selected={!draft.budgetEnabled}
                onPress={() =>
                  store.update({ budgetEnabled: false, weeklyBudgetEur: null })
                }
              />
              <SelectionChip
                label="Maximales Budget in EUR"
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
                label={`Gesamtbudget für ${draft.planningDays} Tage (€)`}
                value={draft.weeklyBudgetEur}
                onChange={(weeklyBudgetEur) =>
                  store.update({ weeklyBudgetEur })
                }
                error={visible.weeklyBudgetEur}
              />
            )}
            <Text style={ui.small}>

              Preise in SmartBasket können Schätzwerte sein.
            </Text>
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
                ? "Wir speichern zuerst auf diesem Gerät und synchronisieren anschließend mit deinem privaten Konto. Falls dies fehlschlägt, siehst du den lokalen Speicherstatus und kannst es erneut versuchen."
                : "Die Cloud ist nicht eingerichtet. Deine Einrichtung wird nur auf diesem Gerät gespeichert."}
            </Text>
          </>
        )}
      </View>
      {step === "review" ? (
        <PrimaryButton
          label={busy ? "Einstellungen werden gespeichert …" : intent === "edit"
            ? "Änderungen speichern" : "Einstellungen speichern"}
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
                ? "Zurück zur Übersicht"
                : "Weiter"
          }
          onPress={next}
          disabled={busy}
        />
      )}
    </Screen>
  );
}
