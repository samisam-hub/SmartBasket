import { router } from "expo-router";
import {
  Chips,
  EmptyState,
  InfoChip,
  Screen,
  SecondaryButton,
  TextButton,
} from "@/components/ui";
import { usePreferences } from "@/context/PreferencesContext";
import { useBasketFlow } from "@/hooks/useBasketFlow";
import { preferenceChips } from "@/services/preference-domain";
export default function BasketSetupScreen() {
  const { saved } = usePreferences();
  const flow = useBasketFlow();
  return (
    <Screen top={false} bottom>
      <InfoChip label="Coming soon · Basket generation" />
      <EmptyState
        title="Your preferences are ready."
        description="Automatic basket creation is not available yet. We’ll use your saved goals, food preferences and budget when it arrives."
        icon="target"
      >
        {saved && <Chips labels={preferenceChips(saved)} />}
        <SecondaryButton
          label="Explore sample products"
          onPress={() => router.dismissTo("/products")}
        />
        <TextButton
          label="Edit preferences"
          disabled={flow.disabled}
          onPress={() => flow.edit()}
        />
      </EmptyState>
    </Screen>
  );
}
