import { useCallback, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { Text } from 'react-native';
import { usePreferences } from '../context/PreferencesContext';
import { basketOwner, basketPersistence } from '../services/baskets';
import type { SavedBasket } from '../types/basket';
import { ui } from '../lib/theme';
import { SectionCard, SecondaryButton } from './ui';
import { SavedBasketPreview } from './SavedBasketPreview';

export function LatestBasket() {
  const { saved, ready } = usePreferences();
  const [latest, setLatest] = useState<SavedBasket | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  useFocusEffect(useCallback(() => {
    let active = true;
    setLatest(null); setWarning(null);
    if (ready) void (async () => {
      try {
        const owner = await basketOwner(saved?.userId ?? null);
        const response = await basketPersistence().list(owner);
        if (active) {
          setLatest([...response.baskets].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0] ?? null);
          setWarning(response.warning);
        }
      } catch { if (active) setWarning("Dein letzter Warenkorb konnte nicht geladen werden. Versuche es im Bereich Warenkorb erneut."); }
    })();
    return () => { active = false; };
  }, [ready, saved?.userId]));
  if (!latest) return warning ? <Text style={ui.small}>{warning}</Text> : null;
  const open = () => router.push({ pathname: '/basket-setup', params: { savedId: latest.id } });
  return <SectionCard title="Dein letzter Warenkorb" compact>
    <SavedBasketPreview basket={latest} onOpen={open} minimal />
    <SecondaryButton label="Diesen Warenkorb wiederverwenden" onPress={open} />
    {warning && <Text style={ui.small}>{warning}</Text>}
  </SectionCard>;
}
