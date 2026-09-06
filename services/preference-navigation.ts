import type { NavigationState, PartialState } from "@react-navigation/native";

export type PreferenceIntent = "onboarding" | "edit";
export type RootStackParams = {
  "(tabs)": undefined;
  "onboarding/[step]": { step: string; intent?: PreferenceIntent; review?: string };
  "basket-setup": undefined;
};

export function preferenceExitState(intent: PreferenceIntent): PartialState<NavigationState<RootStackParams>> {
  // One root-stack transition removes every onboarding route, including deep links.
  // The provider lives above this stack, so saved preferences survive the reset.
  return {
    index: 0,
    routes: [{
      name: "(tabs)",
      state: {
        index: intent === "edit" ? 3 : 0,
        routes: ["index", "products", "basket", "profile"].map((name) => ({ name })),
      },
    }],
  };
}
