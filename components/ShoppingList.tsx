import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { Platform, Pressable, Share, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SavedBasket } from '../types/basket';
import { rowChecked, shoppingListText, shoppingRows } from '../services/basket/shopping-list';
import { shoppingListKey, ShoppingListStore } from '../services/shopping-list-store';
import { ErrorMessage, SectionCard, SecondaryButton, TextButton } from './ui';
import { ui } from '../lib/theme';

export function ShoppingList({ basket }: { basket: SavedBasket }) {
  const store = useMemo(() => new ShoppingListStore(AsyncStorage, shoppingListKey(basket.ownerId, basket.id)), [basket.ownerId, basket.id]);
  const { ready, blocked, error, checked } = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  const rows = useMemo(() => shoppingRows(basket.result), [basket.result]);
  const [copy, setCopy] = useState(false);
  const [sharing, setSharing] = useState(false);
  useEffect(() => { void store.initialize(); setCopy(false); }, [store]);
  useEffect(() => { if (ready) store.reconcile(rows); }, [store, ready, rows]);
  const completed = rows.filter(row => rowChecked(row, checked)).length;
  const text = shoppingListText(basket.name, rows, checked);
  const share = async () => {
    setSharing(true);
    try {
      if (Platform.OS === 'web') {
        if (typeof navigator !== 'undefined' && navigator.share) await navigator.share({ title: "Einkaufsliste", text });
        else setCopy(true);
      } else await Share.share({ title: "Einkaufsliste", message: text });
    } catch (e) {
      if (!(e instanceof Error && e.name === 'AbortError')) setCopy(true);
    } finally { setSharing(false); }
  };
  return <SectionCard title="Einkaufsliste">
    <Text style={ui.small}>{completed}  von {rows.length}  eingepackt</Text>
    <ErrorMessage message={error} />
    {error && !blocked && <TextButton label="Häkchen erneut speichern" onPress={store.retry} />}
    {!ready && <Text style={ui.small}>Häkchen werden geladen …</Text>}
    {!rows.length && <Text style={ui.small}>Dieser Warenkorb enthält keine Einkaufsartikel.</Text>}
    {rows.map(row => <Pressable key={row.id} accessibilityRole="checkbox"
      accessibilityLabel={`${row.name}, ${row.quantity}${row.missing ? ", Produkt noch auswählen" : ''}`}
      accessibilityState={{ checked: rowChecked(row, checked), disabled: !ready || blocked }}
      disabled={!ready || blocked} onPress={() => store.toggle(row)} style={{ paddingVertical: 10 }}>
      <View style={[ui.row, { gap: 10 }]}>
        <Text accessible={false} style={ui.body}>{rowChecked(row, checked) ? '☑' : '☐'}</Text>
        <View style={{ flex: 1 }}>
          <Text style={[ui.body, rowChecked(row, checked) && { textDecorationLine: 'line-through' }]}>{row.name}</Text>
          <Text style={ui.small}>{row.quantity}</Text>
          {row.missing && <Text style={ui.caption}>Wähle ein passendes Produkt. Es ist noch nicht im Warenkorbpreis enthalten.</Text>}
        </View>
      </View>
    </Pressable>)}
    {!!rows.length && <SecondaryButton label="Einkaufsliste teilen" disabled={!ready || sharing} onPress={() => { void share(); }} />}
    {copy && <>
      <Text style={ui.small}>Markiere und kopiere diese Liste in eine Nachricht:</Text>
      <Text selectable style={ui.body}>{text}</Text>
    </>}
    <Text style={ui.caption}>Häkchen bleiben auf diesem Gerät. Beim Teilen wird eine Kopie versendet; Änderungen werden nicht synchronisiert. Ein Häkchen erfasst keinen Einkauf.</Text>
  </SectionCard>;
}
