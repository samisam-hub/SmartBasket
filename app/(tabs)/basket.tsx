import { formatDate, formatMoney, t } from '@/services/i18n';
import { useCallback, useEffect, useState } from 'react';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ActivityIndicator, Share, Text, View } from 'react-native';
import { EmptyState, IconButton, PrimaryButton, Screen, SecondaryButton, SectionCard, SelectionChip, TextButton, TextInput, ErrorMessage } from '@/components/ui';
import { ShoppingLineRow } from '@/components/ShoppingLineRow';
import { useActiveBasket } from '@/context/ActiveBasketContext';
import { useBasketFlow } from '@/hooks/useBasketFlow';
import { useMerchantDemo } from '@/services/merchant-demo';
import { useBasketTicks } from '@/hooks/useBasketTicks';
import { usePreferences } from '@/context/PreferencesContext';
import { hasSavedWork } from '@/services/saved-work';
import { basketOwner, basketPersistence } from '@/services/baskets';
import { addCustomItem, customItemError, loadCustomItems, removeCustomItem, saveCustomItems, type CustomItem } from '@/services/basket/custom-items';
import { fromDemoCatalogue, groupedLines, listEstimate, listName, listPurchase, openingList, shoppingLines, shoppingListText, withAmount } from '@/services/shopping-list';
import { loadLineAmounts, saveLineAmounts, withLineAmount, type LineAmounts } from '@/services/basket/line-amounts';
import { unitSystemOf } from '@/services/units';
import { colors, spacing, ui } from '@/lib/theme';
import type { SavedBasket } from '@/types/basket';

/** The shopping tab: the list the household is buying, opened on the one that matters. */
export default function ShoppingListScreen() {
  const flow = useBasketFlow(), { saved, ready } = usePreferences();
  const { list } = useLocalSearchParams<{ list?: string }>();
  const { demo } = useMerchantDemo();
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
        // Lists built from the fictional merchant catalogue are not this household's shopping.
        if (alive) { setBaskets(response.baskets.filter(saved => demo || !fromDemoCatalogue(saved)));
          setWarning(response.warning); }
      } catch (e) { if (alive) setFailure(e instanceof Error ? e.message : t('basket.loadFailed')); }
      finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, [ready, saved, retry, demo]));

  // Opened from a saved list or straight after creating one, that list is the one to show.
  const asked = baskets.find(saved => saved.id === list) ?? null;
  const basket = asked ?? openingList(baskets, active);
  const [amounts, setAmounts] = useState<LineAmounts>({});
  const planned = basket ? shoppingLines(basket.result) : [];
  // What the plan asked for, corrected by whatever the household typed over it.
  const lines = planned.map(line => amounts[line.key] === undefined ? line : withAmount(line, amounts[line.key]));
  const groups = groupedLines(lines);
  const system = unitSystemOf(saved);
  const { ticked, toggle } = useBasketTicks(basket?.id ?? null,
    [...lines.map(line => line.key), ...extras.map(item => item.id)]);
  // The household's own additions live beside the generated list, and travel with it.
  const listId = basket?.id ?? null;
  useEffect(() => {
    if (!listId) { setExtras([]); setAmounts({}); return; }
    let alive = true;
    void loadCustomItems(AsyncStorage, listId).then(stored => { if (alive) setExtras(stored); }).catch(() => {});
    void loadLineAmounts(AsyncStorage, listId).then(stored => { if (alive) setAmounts(stored); }).catch(() => {});
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
      .catch(() => setFailure(t('basket.shareFailed')));
  };
  const left = lines.length + extras.length - ticked.length;
  // What the till will ask for: whole packages, because that is what a shop sells. What the
  // meals use of them is the second number, and the budget is measured against the first.
  const purchase = listPurchase(lines, extras.length), used = listEstimate(lines, extras.length);
  const budget = saved?.budgetEnabled ? saved.weeklyBudgetEur : null;
  const priceLine = t(purchase.complete ? 'basket.purchase' : 'basket.purchaseFrom', { price: formatMoney(purchase.total) });
  const budgetLine = budget === null ? null
    : t(purchase.total <= budget ? 'basket.inBudget' : 'basket.overBudget',
        { budget: formatMoney(budget), over: formatMoney(Math.abs(purchase.total - budget)) });
  const usedLine = t('basket.used', { price: formatMoney(used.total) });
  const setAmount = (line: { key: string; amount: number }, next: number) => {
    if (!basket) return;
    const base = planned.find(entry => entry.key === line.key)?.amount ?? line.amount;
    const updated = withLineAmount(amounts, line.key, next, base);
    setAmounts(updated);
    void saveLineAmounts(AsyncStorage, basket.id, updated).catch(() => {});
  };

  if (loading && !basket) return <Screen><ActivityIndicator color={colors.primary} /></Screen>;
  if (!basket) return <Screen>
    <EmptyState illustration="emptyBasket" title={t('basket.emptyTitle')} description={t('basket.emptyBody')} />
    <PrimaryButton label={t('basket.create')} onPress={flow.create} disabled={flow.disabled} />
    <ErrorMessage message={failure} />
    {warning && <Text style={ui.small}>{warning}</Text>}
    {failure && <SecondaryButton label={t('basket.reload')} onPress={() => setRetry(n => n + 1)} />}
  </Screen>;
  return <Screen bottom>
    <View style={ui.row}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text accessibilityRole="header" style={ui.title} numberOfLines={2}>{listName(basket)}</Text>
        <Text style={ui.small}>
          {left > 0 ? t('basket.left', { count: left, left, total: lines.length + extras.length }) : t('basket.allIn')}
        </Text>
        {!!lines.length && <>
          <Text style={[ui.body, { fontWeight: '700' }]}>{priceLine}</Text>
          <Text style={ui.small}>{[budgetLine, usedLine].filter(Boolean).join(' · ')}</Text>
        </>}
      </View>
      <IconButton icon="share-2" label={t('basket.share')} onPress={share} />
    </View>
    <ErrorMessage message={failure} />
    {warning && <Text style={ui.small}>{warning}</Text>}
    {basket.result.purchasedAt && <Text style={ui.small}>{t('basket.purchased', { date: formatDate(basket.result.purchasedAt) })}</Text>}
    {/* Every list the household kept, one tap away; the open one is marked. */}
    {baskets.length > 1 && <View style={ui.wrap}>
      {baskets.map(saved => <SelectionChip key={saved.id} label={listName(saved)} selected={saved.id === basket.id}
        onPress={() => router.setParams({ list: saved.id })} />)}
    </View>}
    {groups.map(group => <View key={group.key} style={{ gap: spacing.xs }}>
      <Text style={ui.eyebrow}>{group.label.toUpperCase()}</Text>
      {group.lines.map(line => <ShoppingLineRow key={line.key} name={line.name} quantity={line}
        price={line.purchase?.cost ?? line.estimate} system={system} ticked={ticked.includes(line.key)}
        onTick={() => toggle(line.key)} onAmount={next => setAmount(line, next)} />)}
    </View>)}
    {!!extras.length && <View style={{ gap: spacing.xs }}>
      <Text style={ui.eyebrow}>{t('basket.addedByYou')}</Text>
      {extras.map(item => <ShoppingLineRow key={item.id} name={item.name} note={item.note}
        system={system} ticked={ticked.includes(item.id)} onTick={() => toggle(item.id)}
        onRemove={() => keep(removeCustomItem(extras, item.id))} />)}
    </View>}
    <SectionCard title={t('basket.addTitle')}>
      <TextInput label={t('basket.addWhat')} value={typed} onChangeText={text => { setTyped(text); setAddError(null); }} maxLength={80} />
      <TextInput label={t('basket.addAmount')} value={note} onChangeText={setNote} maxLength={40} />
      <ErrorMessage message={addError} />
      <PrimaryButton label={t('basket.add')} onPress={add} />
      <Text style={ui.small}>{t('basket.addNote')}</Text>
    </SectionCard>
    <TextButton label={t('basket.allLists', { count: baskets.length })} onPress={() => router.push('/saved-lists')} />
  </Screen>;
}
