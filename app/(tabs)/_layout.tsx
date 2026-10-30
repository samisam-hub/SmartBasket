import Feather from "@expo/vector-icons/Feather";
import { Tabs } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, spacing, typography } from "@/lib/theme";
import { useMerchantDemo } from "@/services/merchant-demo";
import { t } from "@/services/i18n";
import { useLocale } from "@/hooks/useLocale";
export default function TabLayout() {
  const insets = useSafeAreaInsets();
  useLocale();
  // The fictional product catalog is a merchant demo, not something a real user should stumble on.
  const { demo } = useMerchantDemo();
  return (
    <Tabs
      safeAreaInsets={insets}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelPosition: "below-icon",
        tabBarStyle: {
          // 56pt visible content, plus exactly the current system-safe area.
          height: 56 + insets.bottom,
          paddingBottom: insets.bottom,
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
        },
        tabBarLabelStyle: { ...typography.caption, fontWeight: "600" },
        tabBarItemStyle: { paddingTop: spacing.xs },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('tab.plan'),
          tabBarIcon: ({ color, size }) => (
            <Feather name="calendar" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="basket"
        options={{
          title: t('tab.list'),
          tabBarIcon: ({ color, size }) => (
            <Feather name="shopping-cart" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="products"
        options={{
          href: demo ? undefined : null,
          title: t('tab.products'),
          tabBarIcon: ({ color, size }) => (
            <Feather name="grid" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('tab.profile'),
          tabBarIcon: ({ color, size }) => (
            <Feather name="user" color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}
