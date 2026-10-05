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
import { NumberInput } from '@/components/NumberInput';
import { OnboardingPeople } from '@/components/OnboardingPeople';
import { householdPatch, onboardingHousehold } from '@/services/participant-domain';
import { PreferenceSummary } from "@/components/PreferenceSummary";
import { usePreferences } from "@/context/PreferencesContext";
import { toggleDiet, validatePreferences } from "@/services/preference-domain";
import {
  allergens,
  diets,
  labels,
  steps,
  onboardingSteps,
  defaultSlotDefaults,
  type OnboardingStep,
  type PreferenceErrors,
} from "@/types/preferences";
import { ui } from "@/lib/theme";
import {
  preferenceExitState,
  type PreferenceIntent,
  type RootStackParams,
} from "@/services/preference-navigation";

const copy: Record<OnboardingStep, { title: string; subtitle: string }> = {
  welcome: {
    title: "Let's build a basket around you.",
    subtitle:
      "Your household, usual meals and dietary restrictions. Your progress is saved on this device as you go.",
  },
  household: {
    title: "Who are we fueling?",
    subtitle: "Choose Adult or Child for each person. Details are optional and can be added later.",
  },
  meals: { title: "Your usual meals.", subtitle: "Choose your daily starting point. You can change each day in the calendar." },
  goals: {
    title: "Fuel your goals.",
    subtitle:
      "Set your daily targets per person. These are your preferences, not a personalized nutrition prescription.",
  },
  diet: {
    title: "Food that fits your life.",
    subtitle:
      "Choose a dietary pattern and any extra restrictions, such as diabetes-friendly. You can change these later.",
  },
  allergies: {
    title: "What should we know?",
    subtitle: "Select allergies and intolerances you want us to remember.",
  },
  budget: {
    title: "What's your grocery budget?",
    subtitle:
      "Set a total for the whole household and your selected planning period.",
  },
  review: {
    title: "Your goals, at a glance.",
    subtitle:
      "Check your preferences before saving. Tap an edit icon to change any section.",
  },
};
const fields: Record<OnboardingStep, (keyof PreferenceErrors)[]> = {
  welcome: [],
  household: ["householdSize", "participants", "dailyCalories"],
  meals: ["slotDefaults"],
  goals: ["dailyCalories", "primaryGoal", "proteinMode", "proteinTargetGrams"],
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
    ? (params.step === "goals" ? "household" : params.step as OnboardingStep)
    : null;
  const returning = params.review === "1" || step === "budget";
  const { draft, ready, saving, configured, localError, store } =
    usePreferences();
  const [attempted, setAttempted] = useState(false);
  const busy = saving || exiting;
  const index = step === "budget" ? onboardingSteps.length - 1 : step ? onboardingSteps.indexOf(step) : 0;
  useEffect(() => {
    if (step && ready) store.goTo(step);
    setAttempted(false);
  }, [step, ready, store]);
  useEffect(() => {
    if (ready && !saving && (!draft.participants || !draft.slotDefaults)) store.update(onboardingHousehold(draft));
  }, [ready, saving, draft, store]);
  const back = useCallback(() => {
    if (busy || pending.current) return;
    if (returning) go("review", intent);
    else if (index > 0) go(onboardingSteps[index - 1], intent);
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
          title="Getting things ready"
          description="Loading your saved progress…"
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
    else go(onboardingSteps[index + 1], intent);
  };
  const finish = async (persist: () => Promise<boolean>) => {
    if (busy || pending.current) return;
    pending.current = true;
    setExiting(true);
    try {
      if ((await persist()) && active.current) exit();
    } finally {
      pending.current = false;
      if (active.current) setExiting(false);
    }
  };
  const save = async () => {
    setAttempted(true);
    if (Object.keys(errors).length) return;
    await finish(store.save);
  };
  return (
    <Screen bottom>
      <View style={[ui.row, { justifyContent: "space-between" }]}>
        <TextButton label="Back" disabled={busy} onPress={back} />
        <TextButton
          label="Save & exit"
          disabled={busy}
          onPress={() => {
            void finish(store.flushDraft);
          }}
        />
      </View>
      <ProgressIndicator current={index + 1} total={onboardingSteps.length} />
      <ScreenHeader {...copy[step]} />
      <ErrorMessage message={localError} />
      <View pointerEvents={busy ? "none" : "auto"} style={ui.stack}>
        {step === "welcome" && (
          <>
            <InfoCard title="A few choices. A stronger start.">
              Your household and food restrictions will guide your meal suggestions. No email or password needed.
            </InfoCard>
            {!configured && (
              <InfoCard title="Try it locally">
                Supabase is not configured. Your answers and completed
                preferences will stay on this device.
              </InfoCard>
            )}
          </>
        )}
        {step === "household" && <>
          <OnboardingPeople people={draft.participants ?? []} onChange={people => store.update(householdPatch(people))} />
          <ErrorMessage message={visible.participants ?? visible.dailyCalories} />
        </>}
        {step === "meals" && <SectionCard>
          <View style={ui.wrap}>{(['breakfast', 'lunch', 'dinner', 'snack'] as const).map(slot => <SelectionChip key={slot}
            label={slot[0].toUpperCase() + slot.slice(1)} selected={(draft.slotDefaults ?? defaultSlotDefaults)[slot]}
            onPress={() => store.update({ slotDefaults: { ...(draft.slotDefaults ?? defaultSlotDefaults), [slot]: !(draft.slotDefaults ?? defaultSlotDefaults)[slot] } })} />)}</View>
          <Text style={ui.small}>Snacks start switched off. These are defaults, not a commitment for every day.</Text>
          <ErrorMessage message={visible.slotDefaults} />
        </SectionCard>}
        {step === "diet" && (
          <SectionCard>
            <View style={ui.wrap}>
              {diets.map((diet) => (
                <SelectionChip
                  key={diet}
                  label={labels[diet]}
                  selected={draft.dietaryPreferences.includes(diet)}
                  onPress={() =>
                    store.update({
                      dietaryPreferences: toggleDiet(draft.dietaryPreferences, diet),
                      participants: draft.participants?.map(p => ({ ...p, dietaryPreferences: toggleDiet(draft.dietaryPreferences, diet) })),
                    })
                  }
                />
              ))}
            </View>
            <Text style={ui.small}>
              Vegetarian, vegan and pescatarian are alternative patterns.
              Lactose-free, gluten-free and diabetes-friendly can be added to
              any pattern.
            </Text>
            <ErrorMessage message={visible.dietaryPreferences} />
          </SectionCard>
        )}
        {step === "diet" && draft.dietaryPreferences.includes("diabetes") && (
          <InfoCard title="How diabetes-friendly filters your basket">
            We keep products whose declared sugars stay under the front-of-pack
            high-sugar level (22.5 g per 100 g, 11.25 g per 100 ml) and meals
            within common carbohydrate portions. Products without a declared
            sugar value are left out rather than assumed low. This is a
            shopping preference, not medical advice or a treatment plan — check
            labels and follow the guidance of your care team.
          </InfoCard>
        )}
        {step === "allergies" && (
          <>
            <SectionCard>
              <View style={ui.wrap}>
                <SelectionChip
                  label="None"
                  selected={!draft.allergens.length}
                  onPress={() => store.update({ allergens: [], participants: draft.participants?.map(p => ({ ...p, allergens: [] })) })}
                />
                {allergens.map((allergen) => (
                  <SelectionChip
                    key={allergen}
                    label={labels[allergen]}
                    selected={draft.allergens.includes(allergen)}
                    onPress={() =>
                      store.update({
                        allergens: draft.allergens.includes(allergen)
                          ? draft.allergens.filter((a) => a !== allergen)
                          : [...draft.allergens, allergen],
                        participants: draft.participants?.map(p => ({ ...p, allergens: draft.allergens.includes(allergen) ? draft.allergens.filter(a => a !== allergen) : [...draft.allergens, allergen] })),
                      })
                    }
                  />
                ))}
              </View>
              <ErrorMessage message={visible.allergens} />
            </SectionCard>
            <InfoCard title="Always check the product label">
              These preferences do not guarantee a product is suitable for an
              allergy. Check ingredients and cross-contact information.
              Lactose-free does not mean milk-free.
            </InfoCard>
          </>
        )}
        {step === "budget" && (
          <SectionCard>
            <View style={ui.wrap}>
              <SelectionChip
                label="No budget limit"
                selected={!draft.budgetEnabled}
                onPress={() =>
                  store.update({ budgetEnabled: false, weeklyBudgetEur: null })
                }
              />
              <SelectionChip
                label="Maximum budget in EUR"
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
                label={`Total budget for ${draft.planningDays} days (€)`}
                value={draft.weeklyBudgetEur}
                onChange={(weeklyBudgetEur) =>
                  store.update({ weeklyBudgetEur })
                }
                error={visible.weeklyBudgetEur}
              />
            )}
            <Text style={ui.small}>
              Prices in SmartBasket may be estimates.
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
                ? "Your household and meal defaults will be saved on this device. Cloud sync for these new preferences is not available yet."
                : "Supabase is not configured. Saving will complete onboarding on this device only."}
            </Text>
          </>
        )}
      </View>
      {step === "review" ? (
        <PrimaryButton
          label={busy ? "Saving preferences…" : intent === "edit"
            ? "Save changes" : "Open my calendar"}
          loading={busy}
          onPress={() => {
            void save();
          }}
        />
      ) : (
        <PrimaryButton
          label={
            step === "welcome"
              ? "Get started"
              : returning
                ? "Back to review"
                : "Continue"
          }
          onPress={next}
          disabled={busy}
        />
      )}
    </Screen>
  );
}
