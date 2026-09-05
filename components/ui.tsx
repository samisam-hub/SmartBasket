import type { PropsWithChildren } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, ui } from '@/lib/theme';

export function Screen({ children, top = true }: PropsWithChildren<{ top?: boolean }>) {
  return <SafeAreaView style={ui.page} edges={top ? ['top', 'left', 'right'] : ['left', 'right', 'bottom']}>
    <ScrollView contentContainerStyle={ui.content} keyboardShouldPersistTaps="handled">{children}</ScrollView>
  </SafeAreaView>;
}

export function Button({ label, onPress, secondary = false }: { label: string; onPress: () => void; secondary?: boolean }) {
  return <Pressable accessibilityRole="button" onPress={onPress}
    style={({ pressed }) => [styles.button, secondary && styles.secondary, pressed && { opacity: 0.75 }]}>
    <Text style={[styles.buttonText, secondary && { color: colors.primary }]}>{label}</Text>
  </Pressable>;
}

export function Chips({ labels }: { labels: readonly string[] }) {
  return <View style={styles.chips}>{labels.map((label) => <View key={label} style={styles.chip}>
    <Text style={styles.chipText}>{label}</Text>
  </View>)}</View>;
}

export function PreferenceRow({ label, value }: { label: string; value: string }) {
  return <View style={styles.preference}><Text style={ui.body}>{label}</Text><Text style={styles.value}>{value}</Text></View>;
}

const styles = StyleSheet.create({
  button: { minHeight: 54, padding: 16, borderRadius: 17, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  secondary: { backgroundColor: colors.pale },
  buttonText: { color: 'white', fontWeight: '700', fontSize: 16 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderRadius: 12, backgroundColor: colors.pale, paddingHorizontal: 12, paddingVertical: 8 },
  chipText: { color: colors.primary, fontSize: 12, fontWeight: '600' },
  preference: { gap: 4, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  value: { color: colors.ink, fontWeight: '600', fontSize: 16 },
});
