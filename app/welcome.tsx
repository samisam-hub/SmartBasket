import { useState } from 'react';
import { router } from 'expo-router';
import { Text, View } from 'react-native';
import { BrandLogo } from '@/components/BrandAssets';
import { IntroArt } from '@/components/IntroArt';
import { ErrorMessage, PrimaryButton, Screen, SecondaryButton, TextButton } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { spacing, ui } from '@/lib/theme';
import { t } from '@/services/i18n';

/** The first screen of the app: say what this is, then let somebody in three ways.
 *
 *  Continuing as a guest is the plain one and asks for nothing — the session already exists, so
 *  this only moves on. An account is offered beside it, not in front of it. */
export default function WelcomeScreen() {
  const { service, ready } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const asGuest = async () => {
    if (busy) return;
    setBusy(true); setError(null);
    try {
      await service?.ensureGuest();
      router.replace('/intro');
    } catch {
      // Without a connection there is still a usable app; only the cloud part is missing.
      setError(t('welcome.offline'));
      router.replace('/intro');
    } finally { setBusy(false); }
  };
  return <Screen bottom>
    <View style={{ gap: spacing.lg, paddingTop: spacing.xl }}>
      <BrandLogo />
      <IntroArt kind="list" />
      <Text accessibilityRole="header" style={[ui.title, { textAlign: 'center' }]}>{t('welcome.title')}</Text>
      <Text style={[ui.body, { textAlign: 'center' }]}>{t('welcome.body')}</Text>
    </View>
    <ErrorMessage message={error} />
    <PrimaryButton label={t('welcome.guest')} loading={busy} disabled={!ready}
      onPress={() => { void asGuest(); }} />
    <Text style={[ui.small, { textAlign: 'center' }]}>{t('welcome.guestNote')}</Text>
    <SecondaryButton label={t('welcome.create')} disabled={busy}
      onPress={() => router.push({ pathname: '/account', params: { mode: 'create' } })} />
    <TextButton label={t('welcome.haveAccount')} disabled={busy}
      onPress={() => router.push({ pathname: '/account', params: { mode: 'signin' } })} />
  </Screen>;
}
