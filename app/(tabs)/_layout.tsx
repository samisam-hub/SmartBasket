import { Feather } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { colors } from '@/lib/theme';

export default function TabLayout() {
  return <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: colors.primary, tabBarInactiveTintColor: colors.muted,
    tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
    tabBarLabelStyle: { fontSize: 11, fontWeight: '600' }, tabBarItemStyle: { paddingVertical: 4 } }}>
    <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: ({ color, size }) => <Feather name="home" color={color} size={size} /> }} />
    <Tabs.Screen name="products" options={{ title: 'Products', tabBarIcon: ({ color, size }) => <Feather name="grid" color={color} size={size} /> }} />
    <Tabs.Screen name="basket" options={{ title: 'Basket', tabBarIcon: ({ color, size }) => <Feather name="shopping-bag" color={color} size={size} /> }} />
    <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: ({ color, size }) => <Feather name="user" color={color} size={size} /> }} />
  </Tabs>;
}
