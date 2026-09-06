import Feather from "@expo/vector-icons/Feather";
import { Tabs } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, spacing, typography } from "@/lib/theme";
export default function TabLayout() {
  const insets = useSafeAreaInsets();
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
          title: "Home",
          tabBarIcon: ({ color, size }) => (
            <Feather name="home" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="products"
        options={{
          title: "Products",
          tabBarIcon: ({ color, size }) => (
            <Feather name="grid" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="basket"
        options={{
          title: "Basket",
          tabBarIcon: ({ color, size }) => (
            <Feather name="shopping-bag" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size }) => (
            <Feather name="user" color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}
