import { router } from "expo-router";
import { Alert, Text } from "react-native";
import {
  InfoCard,
  PreferenceRow,
  PrimaryButton,
  Screen,
  ScreenHeader,
  SectionCard,
  TextButton,
} from "@/components/ui";
import { PersistenceStatus } from "@/components/PersistenceStatus";
import { PreferenceSummary } from "@/components/PreferenceSummary";
import { usePreferences } from "@/context/PreferencesContext";
import { useBasketFlow } from "@/hooks/useBasketFlow";
import { labels } from "@/types/preferences";
import { ui } from "@/lib/theme";
export default function ProfileScreen() {
  const { saved, editing } = usePreferences();
  const flow = useBasketFlow();
  return (
    <Screen>
      <ScreenHeader
        eyebrow="MADE FOR YOU"
        title="Profile"
        subtitle="Your preferences, all in one place."
      />
      <SectionCard title="My preferences">
        {saved ? (
          <PreferenceSummary preferences={saved} />
        ) : (
          <Text style={ui.body}>
            Tell us what matters to you to get started.
          </Text>
        )}
        <PrimaryButton
          label={
            editing
              ? "Resume preference edits"
              : saved
                ? "Edit preferences"
                : "Set my preferences"
          }
          disabled={flow.disabled}
          onPress={() => flow.edit()}
        />
      </SectionCard>
      <PersistenceStatus />
      <SectionCard title="Allergies & intolerances">
        <PreferenceRow
          label="Your selections"
          value={
            saved
              ? saved.allergens.map((a) => labels[a]).join(", ") ||
                "None selected"
              : "Not set"
          }
        />
        <TextButton
          label="Edit allergies"
          disabled={flow.disabled}
          onPress={() => flow.edit("allergies")}
        />
        <Text style={ui.small}>
          Always check product labels. Saved selections do not guarantee allergy
          suitability.
        </Text>
      </SectionCard>
      <SectionCard title="Saved baskets">
        <Text style={ui.body}>
          Saved baskets will appear here when basket creation is available.
        </Text>
        <TextButton
          label="Open basket"
          onPress={() => router.navigate("/basket")}
        />
      </SectionCard>
      <InfoCard title="Notifications">
        Reminders are coming later. SmartBasket does not send notifications yet.
      </InfoCard>
      <SectionCard title="Help & Feedback">
        <Text style={ui.body}>
          Need help saving or changing your preferences?
        </Text>
        <TextButton
          label="View help"
          onPress={() =>
            Alert.alert(
              "SmartBasket help",
              "Use My preferences to edit your answers. Local-only means your preferences are saved on this device but not uploaded. Use Retry cloud sync after reconnecting. Feedback submission is not available yet.",
            )
          }
        />
      </SectionCard>
      <InfoCard title="About SmartBasket">
        Fuel your goals. Version 0.1.0 · Your fitness-oriented grocery
        assistant. Anonymous cloud profiles are tied to this installation;
        reinstalling or clearing app data can lose access.
      </InfoCard>
    </Screen>
  );
}
