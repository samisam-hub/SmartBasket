import { useState } from 'react';
import { router } from 'expo-router';
import { Text, View } from 'react-native';
import { IntroArt } from '@/components/IntroArt';
import { introPages } from '@/services/intro-content';
import { PrimaryButton, ProgressIndicator, Screen, TextButton } from '@/components/ui';
import { spacing, ui } from '@/lib/theme';
import { t } from '@/services/i18n';

export default function IntroScreen() {
  const [page, setPage] = useState(0);
  const pages = introPages();
  const current = pages[page];
  const last = page === pages.length - 1;
  const onward = () => last ? router.replace('/household-setup') : setPage(step => step + 1);
  return <Screen bottom>
    <ProgressIndicator current={page + 1} total={pages.length} />
    <View style={{ gap: spacing.lg, paddingVertical: spacing.xl }}>
      <IntroArt kind={current.kind} />
      <Text accessibilityRole="header" style={[ui.title, { textAlign: 'center' }]}>{current.title}</Text>
      <Text style={[ui.body, { textAlign: 'center' }]}>{current.body}</Text>
      {current.aside && <Text style={[ui.small, { textAlign: 'center' }]}>{current.aside}</Text>}
    </View>
    <PrimaryButton label={t(last ? 'intro.setup' : 'intro.next')} onPress={onward} />
    {!last && <TextButton label={t('intro.skip')} onPress={() => router.replace('/household-setup')} />}
    {page > 0 && <TextButton label={t('intro.back')} onPress={() => setPage(step => step - 1)} />}
  </Screen>;
}
