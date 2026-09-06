import { useEffect, useRef, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Text } from 'react-native';
import { EmptyState, PrimaryButton, Screen, ScreenHeader, SecondaryButton } from '@/components/ui';
import { BasketResult } from '@/components/BasketResult';
import { usePreferences } from '@/context/PreferencesContext';
import { useBasketFlow } from '@/hooks/useBasketFlow';
import { getSupabaseClient } from '@/lib/supabase';
import { colors, ui } from '@/lib/theme';
import { loadBasketCatalog } from '@/services/basket/catalog';
import { generateBasket } from '@/services/basket/basketGenerator';
import { newSavedBasket } from '@/services/basket/persistence';
import { basketOwner, basketPersistence } from '@/services/baskets';
import type { SavedBasket } from '@/types/basket';
export default function BasketSetupScreen() {
  const { saved, ready } = usePreferences(), flow = useBasketFlow();
  const { savedId } = useLocalSearchParams<{ savedId?: string }>();
  const [basket, setBasket] = useState<SavedBasket | null>(null), [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null), [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false), [savedOnce, setSavedOnce] = useState(false), [retry, setRetry] = useState(0);
  const saveLock = useRef(false), mounted = useRef(true);
  const generation = useRef(0);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    if (!ready) return;
    generation.current++;
    const controller = new AbortController();
    setBusy(true); setError(null); setNotice(null); setBasket(null); setSavedOnce(false);
    void (async () => {
      try {
        const owner = await basketOwner(saved?.userId ?? null);
        let next: SavedBasket;
        if (savedId) {
          const response = await basketPersistence().list(owner);
          const found = response.baskets.find(b => b.id === savedId);
          if (!found) throw Error('This saved basket is unavailable for the current session.');
          next = found;
          if (!controller.signal.aborted) { setNotice(response.warning); setSavedOnce(true); }
        } else {
          if (!saved?.onboardingCompleted) throw Error('Complete your preferences before generating a basket.');
          const products = await loadBasketCatalog(getSupabaseClient(), controller.signal);
          await new Promise(resolve => setTimeout(resolve, 0));
          if (controller.signal.aborted) return;
          next = newSavedBasket(generateBasket(saved, products), saved, owner);
        }
        if (!controller.signal.aborted) setBasket(next);
      } catch (e) { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'Basket could not be loaded.'); }
      finally { if (!controller.signal.aborted) setBusy(false); }
    })();
    return () => controller.abort();
  }, [ready, saved, savedId, retry]);
  const save = async () => {
    if (!basket || saveLock.current) return;
    const token = generation.current;
    saveLock.current = true; setSaving(true); setError(null);
    try {
      const owner = await basketOwner(saved?.userId ?? null);
      if (owner !== basket.ownerId) throw Error('Session changed. Generate a new basket before saving.');
      const response = await basketPersistence().save(basket);
      if (mounted.current && token === generation.current) { setBasket(response.basket); setNotice(response.warning ?? 'Saved to this device and your SmartBasket session.'); setSavedOnce(true); }
    } catch (e) { if (mounted.current && token === generation.current) setError(e instanceof Error ? e.message : 'Basket save failed. Retry.'); }
    finally { saveLock.current = false; if (mounted.current) setSaving(false); }
  };
  return <Screen top={false} bottom>
    <ScreenHeader eyebrow="YOUR GROCERIES" title={savedId ? 'Saved basket' : 'Your generated basket'} />
    {busy && <><ActivityIndicator color={colors.primary} /><Text style={ui.body}>Loading products and checking your constraints…</Text></>}
    {error && <Text style={ui.small} accessibilityRole="alert">{error}</Text>}
    {!busy && !basket && <EmptyState title="Basket not available" description="Your saved preferences and catalog are unchanged.">
      <PrimaryButton label="Retry" onPress={() => setRetry(n => n + 1)} />
      <SecondaryButton label="Edit preferences" onPress={() => flow.edit()} disabled={flow.disabled} />
    </EmptyState>}
    {basket && <>
      <Text style={ui.small}>{basket.preferences.planningDays} days · {basket.preferences.householdSize} people · {basket.preferences.dailyCalories} kcal per person per day</Text>
      <BasketResult result={basket.result} />
      {notice && <Text style={ui.small} accessibilityLiveRegion="polite">{notice}</Text>}
      {!!basket.result.items.length && <PrimaryButton label={savedOnce ? basket.syncStatus === 'synced' ? 'Basket saved' : 'Retry cloud save' : 'Save basket'}
        disabled={savedOnce && (basket.syncStatus === 'synced' || !basket.ownerId)} loading={saving} onPress={() => { void save(); }} />}
      <SecondaryButton label="View saved baskets" disabled={saving} onPress={() => router.dismissTo('/basket')} />
      <SecondaryButton label="Edit preferences" disabled={flow.disabled || saving} onPress={() => flow.edit()} />
    </>}
  </Screen>;
}
