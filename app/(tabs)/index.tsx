import Feather from "@expo/vector-icons/Feather";
import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import {
  Chips,
  PrimaryButton,
  Screen,
  ScreenHeader,
  SectionCard,
  TextButton,
} from "@/components/ui";
import { PersistenceStatus } from "@/components/PersistenceStatus";
import { usePreferences } from "@/context/PreferencesContext";
import { useBasketFlow } from "@/hooks/useBasketFlow";
import { preferenceChips } from "@/services/preference-domain";
import { colors, radii, spacing, ui } from "@/lib/theme";
export default function HomeScreen() {
  const { saved, editing } = usePreferences();
  const flow = useBasketFlow();
  return (
    <Screen>
      <View style={ui.row}>
        <View style={styles.logo}>
          <Feather name="zap" size={24} color={colors.onPrimary} />
        </View>
        <Text style={ui.subheading}>SmartBasket</Text>
      </View>
      <View style={styles.hero}>
        <ScreenHeader
          eyebrow="FUEL YOUR GOALS"
          title="Good food for a stronger you."
          subtitle="Personalized groceries based on your goals, lifestyle and budget."
        />
        <View style={styles.heroIcon}>
          <Feather name="target" size={56} color={colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={ui.subheading}>Your next strong week</Text>
            <Text style={ui.small}>Starts with what’s in your basket.</Text>
          </View>
        </View>
        <PrimaryButton
          label="Create my basket"
          disabled={flow.disabled}
          onPress={flow.create}
        />
      </View>
      {saved && (
        <SectionCard title="Your current preferences">
          <Chips labels={preferenceChips(saved)} />
          <TextButton
            label={editing ? "Resume preference edits" : "Edit preferences"}
            disabled={flow.disabled}
            onPress={() => flow.edit()}
          />
        </SectionCard>
      )}
      <PersistenceStatus />
      <SectionCard title="Built around your everyday">
        {(
          [
            {
              icon: "target",
              title: "Supports your goals",
              detail: "Keep your fitness priorities in focus.",
            },
            {
              icon: "heart",
              title: "Tailored nutrition",
              detail: "Make room for your food preferences.",
            },
            {
              icon: "clock",
              title: "Save time & money",
              detail: "Plan ahead with a budget that fits.",
            },
          ] as const
        ).map((item) => (
          <View key={item.title} style={ui.row}>
            <Feather name={item.icon} size={24} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={ui.body}>{item.title}</Text>
              <Text style={ui.small}>{item.detail}</Text>
            </View>
          </View>
        ))}
        <TextButton
          label="Explore products"
          onPress={() => router.navigate("/products")}
        />
      </SectionCard>
    </Screen>
  );
}
const styles = StyleSheet.create({
  logo: {
    backgroundColor: colors.primary,
    borderRadius: radii.medium,
    padding: spacing.md,
  },
  hero: { gap: spacing.xl },
  heroIcon: {
    padding: spacing.xl,
    borderRadius: radii.xl,
    backgroundColor: colors.pale,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.lg,
  },
});
