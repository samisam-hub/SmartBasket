import { useEffect, useRef, useState } from 'react';
import { router } from 'expo-router';
import { ActivityIndicator, Text, View } from 'react-native';
import { ErrorMessage, PrimaryButton, Screen, SecondaryButton, SectionCard } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { usePreferences } from '@/context/PreferencesContext';
import { quickStart } from '@/services/quick-start';
import { ui } from '@/lib/theme';

/** The link a tester opens in a shop: smartbasket://try, or /try on the web build.
 *
 *  It asks nothing. The guest session already starts with the app, so all this does is put a
 *  sample household in place when there is none, and then get out of the way. Opening it again
 *  later changes nothing, so a half-finished week survives a second scan of the same code. */
export default function TryScreen() {
  const { ready, saving, store } = usePreferences();
  const { error: authError } = useAuth();
  const [failed, setFailed] = useState(false);
  const started = useRef(false);
  useEffect(() => {
    if (!ready || saving || started.current) return;
    started.current = true;
    void quickStart(store).then(result => {
      if (result === 'failed') { started.current = false; setFailed(true); return; }
      if (result === 'busy') { started.current = false; return; }
      router.replace('/');
    });
  }, [ready, saving, store]);
  if (failed) return <Screen bottom>
    <SectionCard title="That did not work">
      <Text style={ui.body}>
        The sample household could not be saved on this device. Nothing was changed.
      </Text>
      <ErrorMessage message={authError} />
      <PrimaryButton label="Try again" onPress={() => { setFailed(false); started.current = false; }} />
      <SecondaryButton label="Set up my own preferences" onPress={() => router.replace('/')} />
    </SectionCard>
  </Screen>;
  return <Screen>
    <View style={{ gap: 12, alignItems: 'center', paddingVertical: 48 }}>
      <ActivityIndicator />
      <Text style={ui.body}>Setting up a sample household…</Text>
      <Text style={ui.small}>No account needed. You can change everything afterwards.</Text>
    </View>
  </Screen>;
}
