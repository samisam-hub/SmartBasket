import { useState } from 'react';
import { router } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';
import { Text, View } from 'react-native';
import { IntroArt } from '@/components/IntroArt';
import { introPages } from '@/services/intro-content';
import { PrimaryButton, ProgressIndicator, Screen, TextButton } from '@/components/ui';
import { colors, radii, spacing, typography, ui } from '@/lib/theme';
import { t } from '@/services/i18n';

/** One promise or one step per line: a tick where the app is saying what it watches for you, a
 *  number where the order is the point. */
function Point({ marker, index, text }: { marker: 'check' | 'number'; index: number; text: string }) {
  return <View style={styles.point}>
    <View style={[styles.marker, marker === 'check' && styles.markerCheck]}>
      {marker === 'check'
        ? <Feather name="check" size={16} color={colors.onPrimary} />
        : <Text style={styles.markerNumber}>{index + 1}</Text>}
    </View>
    <Text style={[ui.body, { flex: 1, minWidth: 0 }]}>{text}</Text>
  </View>;
}
export default function IntroScreen() {
  const [page, setPage] = useState(0);
  const pages = introPages();
  const current = pages[page];
  const last = page === pages.length - 1;
  const onward = () => last ? router.replace('/household-setup') : setPage(step => step + 1);
  return <Screen bottom>
    <ProgressIndicator current={page + 1} total={pages.length} />
    <View style={{ gap: spacing.lg, paddingVertical: spacing.lg }}>
      <IntroArt kind={current.kind} />
      <Text accessibilityRole="header" style={[ui.title, { textAlign: 'center' }]}>{current.title}</Text>
      {current.body && <Text style={[ui.body, { textAlign: 'center' }]}>{current.body}</Text>}
      {current.points && <View style={{ gap: spacing.md }}>
        {current.points.items.map((text, index) =>
          <Point key={text} marker={current.points!.marker} index={index} text={text} />)}
      </View>}
      {current.aside && <Text style={[ui.small, { textAlign: 'center' }]}>{current.aside}</Text>}
    </View>
    <PrimaryButton label={t(last ? 'intro.setup' : 'intro.next')} onPress={onward} />
    {!last && <TextButton label={t('intro.skip')} onPress={() => router.replace('/household-setup')} />}
    {page > 0 && <TextButton label={t('intro.back')} onPress={() => setPage(step => step - 1)} />}
  </Screen>;
}
const styles = {
  point: { flexDirection: 'row' as const, alignItems: 'flex-start' as const, gap: spacing.md },
  marker: { width: 26, height: 26, borderRadius: radii.pill, alignItems: 'center' as const,
    justifyContent: 'center' as const, backgroundColor: colors.pale },
  markerCheck: { backgroundColor: colors.primary },
  markerNumber: { ...typography.caption, fontWeight: '800' as const, color: colors.primary },
};
