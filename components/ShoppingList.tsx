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
        if (typeof navigator !== 'undefined' && navigator.share) await navigator.share({ title: 'Shopping list', text });
        else setCopy(true);
      } else await Share.share({ title: 'Shopping list', message: text });
    } catch (e) {
      if (!(e instanceof Error && e.name === 'AbortError')) setCopy(true);
    } finally { setSharing(false); }
  };
  return <SectionCard title="Shopping list">
    <Text style={ui.small}>{completed} of {rows.length} picked up</Text>
    <ErrorMessage message={error} />
    {error && !blocked && <TextButton label="Retry saving checkmarks" onPress={store.retry} />}
    {!ready && <Text style={ui.small}>Loading checkmarks…</Text>}
    {!rows.length && <Text style={ui.small}>No shopping items in this basket.</Text>}
    {rows.map(row => <Pressable key={row.id} accessibilityRole="checkbox"
      accessibilityLabel={`${row.name}, ${row.quantity}${row.missing ? ', product still to choose' : ''}`}
      accessibilityState={{ checked: rowChecked(row, checked), disabled: !ready || blocked }}
      disabled={!ready || blocked} onPress={() => store.toggle(row)} style={{ paddingVertical: 10 }}>
      <View style={[ui.row, { gap: 10 }]}>
        <Text accessible={false} style={ui.body}>{rowChecked(row, checked) ? '☑' : '☐'}</Text>
        <View style={{ flex: 1 }}>
          <Text style={[ui.body, rowChecked(row, checked) && { textDecorationLine: 'line-through' }]}>{row.name}</Text>
          <Text style={ui.small}>{row.quantity}</Text>
          {row.missing && <Text style={ui.caption}>Choose a suitable product; not included in the basket price.</Text>}
        </View>
      </View>
    </Pressable>)}
    {!!rows.length && <SecondaryButton label="Share shopping list" disabled={!ready || sharing} onPress={() => { void share(); }} />}
    {copy && <>
      <Text style={ui.small}>Select and copy this list into a message:</Text>
      <Text selectable style={ui.body}>{text}</Text>
    </>}
    <Text style={ui.caption}>Checkmarks stay on this device. Sharing sends a copy; changes are not synced. Checking an item does not record a purchase.</Text>
  </SectionCard>;
}
