import { router } from "expo-router";
import {
  EmptyState,
  PrimaryButton,
  Screen,
  ScreenHeader,
  SecondaryButton,
} from "@/components/ui";
import { useBasketFlow } from "@/hooks/useBasketFlow";
export default function BasketScreen() {
  const flow = useBasketFlow();
  return (
    <Screen>
      <ScreenHeader eyebrow="YOUR GOALS. YOUR GROCERIES." title="Your basket" />
      <EmptyState
        title="Your basket is empty."
        description="Set your preferences now. Personalized basket generation is coming next."
      >
        <PrimaryButton
          label="Create my basket"
          onPress={flow.create}
          disabled={flow.disabled}
        />
        <SecondaryButton
          label="Browse products"
          onPress={() => router.navigate("/products")}
        />
      </EmptyState>
    </Screen>
  );
}
