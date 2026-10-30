import { formatDate } from '@/services/i18n';
import { useCallback, useEffect, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ActivityIndicator, Share, Text, View } from 'react-native';
import { EmptyState, IconButton, PrimaryButton, Screen, SecondaryButton, SectionCard, TextButton, TextInput, ErrorMessage } from '@/components/ui';
import { ShoppingLineRow } from '@/components/ShoppingLineRow';
import { useActiveBasket } from '@/context/ActiveBasketContext';
import { useBasketFlow } from '@/hooks/useBasketFlow';
import { useBasketTicks } from '@/hooks/useBasketTicks';
import { usePreferences } from '@/context/PreferencesContext';
import { hasSavedWork } from '@/services/saved-work';
import { basketOwner, basketPersistence } from '@/services/baskets';
import { addCustomItem, customItemError, loadCustomItems, removeCustomItem, saveCustomItems, type CustomItem } from '@/services/basket/custom-items';
import { groupedLines, listName, openingList, shoppingLines, shoppingListText } from '@/services/shopping-list';
import { unitSystemOf } from '@/services/units';
import { colors, spacing, ui } from '@/lib/theme';
import type { SavedBasket } from '@/types/basket';

/** The shopping tab: the list the household is buying, opened on the one that matters. */
export default function ShoppingListScreen() {
  const flow = useBasketFlow(), { saved, ready } = usePreferences();
  const { active } = useActiveBasket();
  const [baskets, setBaskets] = useState<SavedBasket[]>([]), [loading, setLoading] = useState(true);
  const [warning, setWarning] = useState<string | null>(null), [retry, setRetry] = useState(0);
  const [failure, setFailure] = useState<string | null>(null);
  const [extras, setExtras] = useState<CustomItem[]>([]), [typed, setTyped] = useState('');
  const [note, setNote] = useState(''), [addError, setAddError] = useState<string | null>(null);
  useFocusEffect(useCallback(() => {
    if (!ready) return;
    // A guest who has not finished setting up cannot have a saved list; the empty state is the
    // honest answer, without a round trip and without a notice about data nobody has yet.
    if (!hasSavedWork(saved)) { setBaskets([]); setWarning(null); setLoading(false); return; }
    void retry;
    let alive = true; setLoading(true);
    void (async () => {
      try {
        const owner = await basketOwner(saved?.userId ?? null);
        const response = await basketPersistence().list(owner);
        if (alive) { setBaskets(response.baskets); setWarning(response.warning); }
      } catch (e) { if (alive) setFailure(e instanceof Error ? e.message : 'Gespeicherte Listen konnten nicht geladen werden.'); }
      finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, [ready, saved, retry]));

  const basket = openingList(baskets, active);
  const lines = basket ? shoppingLines(basket.result) : [];
  const groups = groupedLines(lines);
  const system = unitSystemOf(saved);
  const { ticked, toggle } = useBasketTicks(basket?.id ?? null,
    [...lines.map(line => line.key), ...extras.map(item => item.id)]);
  // The household's own additions live beside the generated list, and travel with it.
  const listId = basket?.id ?? null;
  useEffect(() => {
    if (!listId) { setExtras([]); return; }
    let alive = true;
    void loadCustomItems(AsyncStorage, listId).then(stored => { if (alive) setExtras(stored); }).catch(() => {});
    return () => { alive = false; };
  }, [listId]);
  const keep = (next: CustomItem[]) => {
    setExtras(next);
    if (basket) void saveCustomItems(AsyncStorage, basket.id, next).catch(() => {});
  };
  const add = () => {
    const problem = customItemError(typed);
    if (problem) { setAddError(problem); return; }
    keep(addCustomItem(extras, typed, note));
    setTyped(''); setNote(''); setAddError(null);
  };
  const share = () => {
    if (!basket) return;
    void Share.share({ message: shoppingListText({ name: listName(basket), groups, extras, ticked, system }) })
      .catch(() => setFailure('Die Liste konnte von diesem Gerät nicht geteilt werden.'));
  };
  const left = lines.length + extras.length - ticked.length;

  if (loading && !basket) return <Screen><ActivityIndicator color={colors.primary} /></Screen>;
  if (!basket) return <Screen>
    <EmptyState illustration="emptyBasket" title="Noch keine Einkaufsliste."
      description="Plane ein paar Mahlzeiten und erstelle daraus eine Liste." />
    <PrimaryButton label="Liste erstellen" onPress={flow.create} disabled={flow.disabled} />
    <ErrorMessage message={failure} />
    {warning && <Text style={ui.small}>{warning}</Text>}
    {failure && <SecondaryButton label="Neu laden" onPress={() => setRetry(n => n + 1)} />}
  </Screen>;
  return <Screen bottom>
    <View style={ui.row}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text accessibilityRole="header" style={ui.title} numberOfLines={2}>{listName(basket)}</Text>
        <Text style={ui.small}>
          {left > 0 ? `${left} von ${lines.length + extras.length} noch zu kaufen` : 'Alles liegt im Wagen'}
        </Text>
      </View>
      <IconButton icon="share-2" label="Diese Liste teilen" onPress={share} />
    </View>
    <ErrorMessage message={failure} />
    {warning && <Text style={ui.small}>{warning}</Text>}
    {basket.result.purchasedAt && <Text style={ui.small}>
      Gekauft am {formatDate(basket.result.purchasedAt)}. Das ist ein Beleg, keine Einkaufsliste.
    </Text>}
    {groups.map(group => <View key={group.key} style={{ gap: spacing.xs }}>
      <Text style={ui.eyebrow}>{group.label.toUpperCase()}</Text>
      {group.lines.map(line => <ShoppingLineRow key={line.key} name={line.name} quantity={line}
        system={system} ticked={ticked.includes(line.key)} onTick={() => toggle(line.key)} />)}
    </View>)}
    {!!extras.length && <View style={{ gap: spacing.xs }}>
      <Text style={ui.eyebrow}>VON DIR ERGÄNZT</Text>
      {extras.map(item => <ShoppingLineRow key={item.id} name={item.name} note={item.note}
        system={system} ticked={ticked.includes(item.id)} onTick={() => toggle(item.id)}
        onRemove={() => keep(removeCustomItem(extras, item.id))} />)}
    </View>}
    <SectionCard title="Etwas ergänzen">
      <TextInput label="Was brauchst du?" value={typed} onChangeText={text => { setTyped(text); setAddError(null); }} maxLength={80} />
      <TextInput label="Wie viel? (optional)" value={note} onChangeText={setNote} maxLength={40} />
      <ErrorMessage message={addError} />
      <PrimaryButton label="Zur Liste hinzufügen" onPress={add} />
      <Text style={ui.small}>
        Deine eigenen Zeilen gehören zu dieser Liste und werden mit ihr geteilt. Sie sind nicht Teil
        des Plans und ändern deshalb keine Portionen, keine Nährwerte und kein Budget.
      </Text>
    </SectionCard>
    <TextButton label="Alle meine Listen" onPress={() => router.push('/saved-lists')} />
  </Screen>;
}
