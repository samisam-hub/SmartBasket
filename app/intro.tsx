import { useState } from 'react';
import { router } from 'expo-router';
import { Text, View } from 'react-native';
import { IntroArt } from '@/components/IntroArt';
import { introPages } from '@/services/intro-content';
import { PrimaryButton, ProgressIndicator, Screen, TextButton } from '@/components/ui';
import { spacing, ui } from '@/lib/theme';

export default function IntroScreen() {
  const [page, setPage] = useState(0);
  const current = introPages[page];
  const last = page === introPages.length - 1;
  const onward = () => last ? router.replace('/household-setup') : setPage(step => step + 1);
  return <Screen bottom>
    <ProgressIndicator current={page + 1} total={introPages.length} />
    <View style={{ gap: spacing.lg, paddingVertical: spacing.xl }}>
      <IntroArt kind={current.kind} />
      <Text accessibilityRole="header" style={[ui.title, { textAlign: 'center' }]}>{current.title}</Text>
      <Text style={[ui.body, { textAlign: 'center' }]}>{current.body}</Text>
      {current.aside && <Text style={[ui.small, { textAlign: 'center' }]}>{current.aside}</Text>}
    </View>
    <PrimaryButton label={last ? 'Set up my household' : 'Next'} onPress={onward} />
    {!last && <TextButton label="Skip" onPress={() => router.replace('/household-setup')} />}
    {page > 0 && <TextButton label="Back" onPress={() => setPage(step => step - 1)} />}
  </Screen>;
}
