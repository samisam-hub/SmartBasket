import { StyleSheet } from 'react-native';

export const colors = {
  background: '#F8F8F2', surface: '#FFFFFF', ink: '#203A2D', muted: '#637066',
  primary: '#216E48', pale: '#EAF0DE', border: '#E2E7DA', peach: '#F5DFC5',
};

export const ui = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  content: { padding: 24, paddingBottom: 36, gap: 24 },
  title: { fontSize: 32, fontWeight: '700', color: colors.ink, letterSpacing: -1 },
  heading: { fontSize: 22, fontWeight: '700', color: colors.ink, letterSpacing: -0.4 },
  body: { fontSize: 16, lineHeight: 24, color: colors.muted },
  eyebrow: { fontSize: 12, fontWeight: '700', letterSpacing: 1.8, color: colors.primary },
  card: { backgroundColor: colors.surface, borderRadius: 24, padding: 22, gap: 14, borderWidth: 1, borderColor: colors.border },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
});
