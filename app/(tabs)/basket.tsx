import { useCallback, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { ActivityIndicator, Text } from 'react-native';
import { EmptyState, PrimaryButton, Screen, ScreenHeader, SecondaryButton, SectionCard } from '@/components/ui';
import { basketPrice } from '@/components/BasketResult';
import { useBasketFlow } from '@/hooks/useBasketFlow';
import { usePreferences } from '@/context/PreferencesContext';
import { basketOwner, basketPersistence } from '@/services/baskets';
import { colors, ui } from '@/lib/theme';
import type { SavedBasket } from '@/types/basket';
export default function BasketScreen() {
  const flow = useBasketFlow(), { saved, ready } = usePreferences();
  const [baskets, setBaskets] = useState<SavedBasket[]>([]), [loading, setLoading] = useState(true);
  const [warning, setWarning] = useState<string | null>(null), [retry, setRetry] = useState(0);
  useFocusEffect(useCallback(() => {
    if (!ready) return;
    void retry; // Explicit reload token in addition to focus/session changes.
    let active = true; setLoading(true); setBaskets([]);
    void (async () => {
      try {
        const owner = await basketOwner(saved?.userId ?? null);
        const response = await basketPersistence().list(owner);
        if (active) { setBaskets(response.baskets); setWarning(response.warning); }
      } catch (e) { if (active) setWarning(e instanceof Error ? e.message : 'Saved baskets could not be loaded.'); }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [ready, saved?.userId, retry]));
  return <Screen>
    <ScreenHeader eyebrow="YOUR GOALS. YOUR GROCERIES." title="Your baskets" />
    <PrimaryButton label="Create my basket" onPress={flow.create} disabled={flow.disabled} />
    {loading && <ActivityIndicator color={colors.primary} />}
    {warning && <><Text style={ui.small}>{warning}</Text><SecondaryButton label="Reload saved baskets" onPress={() => setRetry(n => n + 1)} /></>}
    {!loading && !baskets.length && <EmptyState title="No saved baskets yet." description="Generate a basket from your preferences, then save it here." />}
    {baskets.map(b => <SectionCard key={b.id} title={b.name}>
      <Text style={ui.small}>{new Date(b.createdAt).toLocaleDateString()} · {b.result.items.length} products · {b.syncStatus === 'synced' ? 'Synced' : 'On this device'}</Text>
      <Text style={ui.body}>{basketPrice(b.result.estimatedTotalPrice)}</Text>
      <SecondaryButton label="Open basket" onPress={() => router.push({ pathname: '/basket-setup', params: { savedId: b.id } })} />
    </SectionCard>)}
    <SecondaryButton label="Browse products" onPress={() => router.navigate('/products')} />
  </Screen>;
}
