import { formatDate, formatMoney, t } from '@/services/i18n';
import { useCallback, useEffect, useState } from 'react';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ActivityIndicator, Share, Text, View } from 'react-native';
import { EmptyState, IconButton, PrimaryButton, Screen, SecondaryButton, SelectionChip, TextButton, ErrorMessage } from '@/components/ui';
import { ShoppingDraftRow, ShoppingLineRow, ShoppingLineTicked } from '@/components/ShoppingLineRow';
import { useActiveBasket } from '@/context/ActiveBasketContext';
import { useBasketFlow } from '@/hooks/useBasketFlow';
import { useMerchantDemo } from '@/services/merchant-demo';
import { useBasketTicks } from '@/hooks/useBasketTicks';
import { usePreferences } from '@/context/PreferencesContext';
import { hasSavedWork } from '@/services/saved-work';
import { basketOwner, basketPersistence } from '@/services/baskets';
import { addCustomItem, customItemError, loadCustomItems, removeCustomItem, saveCustomItems, type CustomItem } from '@/services/basket/custom-items';
import { fromDemoCatalogue, groupedLines, listEstimate, listName, listPurchase, openingList, shoppingLines, shoppingListText, tinSize, withAmount } from '@/services/shopping-list';
import { loadLineAmounts, saveLineAmounts, withLineAmount, type LineAmounts } from '@/services/basket/line-amounts';
import { loadListEdits, noEdits, saveListEdits, withLine, withoutLine, type ListEdits } from '@/services/basket/list-edits';
import { unitSystemOf } from '@/services/units';
import { colors, radii, spacing, ui } from '@/lib/theme';
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
  // Editing the list and switching between lists are rare; the list itself is why anybody is
  // here. Both live behind one button so the first items fit on the screen.
  const [menu, setMenu] = useState(false);
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
  const [edits, setEdits] = useState<ListEdits>(noEdits);
  const [undo, setUndo] = useState<{ key: string; name: string } | null>(null);
  const planned = basket ? shoppingLines(basket.result) : [];
  // What the plan asked for, minus what the household already had, corrected by what it typed.
  const lines = planned.filter(line => !edits.removed.includes(line.key))
    .map(line => amounts[line.key] === undefined ? line : withAmount(line, amounts[line.key]));
  const groups = groupedLines(lines);
  const system = unitSystemOf(saved);
  const { ticked, toggle } = useBasketTicks(basket?.id ?? null,
    [...lines.map(line => line.key), ...extras.map(item => item.id)]);
  // The household's own additions live beside the generated list, and travel with it.
  const listId = basket?.id ?? null;
  useEffect(() => {
    if (!listId) { setExtras([]); setAmounts({}); setEdits(noEdits); return; }
    let alive = true;
    setUndo(null);
    void loadCustomItems(AsyncStorage, listId).then(stored => { if (alive) setExtras(stored); }).catch(() => {});
    void loadLineAmounts(AsyncStorage, listId).then(stored => { if (alive) setAmounts(stored); }).catch(() => {});
    void loadListEdits(AsyncStorage, listId).then(stored => { if (alive) setEdits(stored); }).catch(() => {});
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
  // Taking a line out, saving the list and going back to editing it are all the same write.
  const keepEdits = (next: ListEdits) => {
    setEdits(next);
    if (basket) void saveListEdits(AsyncStorage, basket.id, next).catch(() => {});
  };
  const removeLine = (line: { key: string; name: string }) => {
    keepEdits(withoutLine(edits, line.key));
    setUndo({ key: line.key, name: line.name });
  };
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
  const total = lines.length + extras.length;
  const head = <>
    <View style={ui.row}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text accessibilityRole="header" style={ui.title} numberOfLines={2}>{listName(basket)}</Text>
        <Text style={ui.small}>
          {edits.saved
            ? [t('basket.savedOn'), left > 0 ? t('basket.left', { count: left, left, total })
              : t('basket.allIn')].join(' · ')
            : t('basket.items', { count: total })}
        </Text>
        {!!lines.length && <>
          <Text style={[ui.body, { fontWeight: '700' }]}>{priceLine}</Text>
          <Text style={ui.small}>{[budgetLine, usedLine].filter(Boolean).join(' · ')}</Text>
        </>}
      </View>
      {/* One button for everything that is not ticking something off: two would squeeze the
        * figures above the list into another line, and this is a list, not a toolbar. */}
      {edits.saved && <IconButton icon="more-vertical" label={t('basket.more')}
        onPress={() => setMenu(open => !open)} />}
    </View>
    {edits.saved && menu && <View style={styles.menu}>
      <TextButton label={t('basket.share')} onPress={() => { setMenu(false); share(); }} />
      <TextButton label={t('basket.edit')} onPress={() => { setMenu(false); keepEdits({ ...edits, saved: false }); }} />
      <TextButton label={t('basket.allLists', { count: baskets.length })}
        onPress={() => { setMenu(false); router.push('/saved-lists'); }} />
    </View>}
    <ErrorMessage message={failure} />
    {warning && <Text style={ui.small}>{warning}</Text>}
    {basket.result.purchasedAt && <Text style={ui.small}>{t('basket.purchased', { date: formatDate(basket.result.purchasedAt) })}</Text>}
    {/* Every list the household kept, one tap away; the open one is marked. */}
    {baskets.length > 1 && <View style={ui.wrap}>
      {baskets.map(saved => <SelectionChip key={saved.id} label={listName(saved)} selected={saved.id === basket.id}
        onPress={() => router.setParams({ list: saved.id })} />)}
    </View>}
  </>;

  // Reading the list through: no ticks yet, every line can be taken out, amounts can be corrected.
  if (!edits.saved) return <Screen bottom>
    {head}
    <View style={styles.hint}>
      <Text style={[ui.body, { fontWeight: '700' }]}>{t('basket.introTitle')}</Text>
      <Text style={ui.body}>{t('basket.intro')}</Text>
    </View>
    {groups.map(group => <View key={group.key} style={{ gap: spacing.xs }}>
      <Text style={ui.eyebrow}>{group.label.toUpperCase()}</Text>
      {group.lines.map(line => <ShoppingLineRow key={line.key} name={line.name} quantity={line}
        tin={tinSize(line.key)} price={line.purchase?.cost ?? line.estimate} system={system}
        onAmount={next => setAmount(line, next)} onRemove={() => removeLine(line)} />)}
    </View>)}
    {!!extras.length && <View style={{ gap: spacing.xs }}>
      <Text style={ui.eyebrow}>{t('basket.addedByYou')}</Text>
      {extras.map(item => <ShoppingLineRow key={item.id} name={item.name} note={item.note}
        system={system} onRemove={() => keep(removeCustomItem(extras, item.id))} />)}
    </View>}
    {/* The next line of the list, empty and ready: no card, no labels, no second button. */}
    <ShoppingDraftRow name={typed} amount={note} onAdd={add}
      onName={text => { setTyped(text); setAddError(null); }} onAmount={setNote} />
    <ErrorMessage message={addError} />
    {/* A line taken out by mistake is one tap away, until the next one is taken out. */}
    {undo && <View style={styles.undo}>
      <Text style={[ui.small, { color: colors.onPrimary, flex: 1, minWidth: 0 }]} numberOfLines={1}>
        {t('basket.removed', { name: undo.name })}
      </Text>
      <TextButton label={t('basket.undo')} onPress={() => { keepEdits(withLine(edits, undo.key)); setUndo(null); }} />
    </View>}
    <PrimaryButton label={t('basket.save')} onPress={() => { keepEdits({ ...edits, saved: true }); setUndo(null); }} />
  </Screen>;

  // Shopping it: compact rows in one card, the tick at the end of each.
  return <Screen bottom>
    {head}
    <View style={styles.card}>
      {groups.map(group => <View key={group.key}>
        <View style={styles.groupHead}>
          <Text style={[ui.eyebrow, { flex: 1, minWidth: 0 }]}>{group.label.toUpperCase()}</Text>
          <Text style={ui.small}>{t('basket.groupSum', { count: group.lines.length,
            price: formatMoney(listPurchase(group.lines).total) })}</Text>
        </View>
        {group.lines.map(line => <ShoppingLineTicked key={line.key} name={line.name} quantity={line}
          tin={tinSize(line.key)} price={line.purchase?.cost ?? line.estimate} system={system}
          ticked={ticked.includes(line.key)} onTick={() => toggle(line.key)} />)}
      </View>)}
      {!!extras.length && <View>
        <View style={styles.groupHead}>
          <Text style={[ui.eyebrow, { flex: 1, minWidth: 0 }]}>{t('basket.addedByYou')}</Text>
        </View>
        {extras.map(item => <ShoppingLineTicked key={item.id} name={item.name} note={item.note}
          system={system} ticked={ticked.includes(item.id)} onTick={() => toggle(item.id)} />)}
      </View>}
    </View>
    <Text style={ui.small}>{t('basket.tickNote')}</Text>
  </Screen>;
}
const styles = {
  hint: { backgroundColor: colors.pale, borderWidth: 1, borderColor: colors.secondary,
    borderRadius: radii.large, padding: spacing.md, gap: 2 },
  undo: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: spacing.sm,
    backgroundColor: colors.ink, borderRadius: radii.medium, paddingLeft: spacing.md, paddingRight: spacing.xs },
  menu: { backgroundColor: colors.surface, borderRadius: radii.large, borderWidth: 1,
    borderColor: colors.border, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: radii.large, overflow: 'hidden' as const },
  groupHead: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: spacing.sm,
    backgroundColor: colors.pale, paddingVertical: 6, paddingHorizontal: spacing.lg - 2 },
};
