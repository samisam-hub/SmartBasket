import { router } from "expo-router";
import { usePreferences } from "@/context/PreferencesContext";
import type { OnboardingStep } from "@/types/preferences";
export function useBasketFlow() {
  const { store, saved, ready, saving } = usePreferences();
  const edit = (step?: OnboardingStep) => {
    if (!ready || saving) return;
    router.push({
      pathname: "/onboarding/[step]",
      params: {
        step: store.begin(step),
        intent: saved?.onboardingCompleted ? "edit" : "onboarding",
      },
    });
  };
  return {
    edit,
    disabled: !ready || saving,
    create: () => {
      if (!ready || saving) return;
      if (saved?.onboardingCompleted) router.push("/basket-setup");
      else edit();
    },
  };
}
